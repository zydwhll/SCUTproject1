#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLECharacteristic.h>
#include <BLE2902.h>
#include <driver/adc.h>

// 蓝牙配置
#define BLE_DEVICE_NAME "ESP32C3_Pressure"
#define BLE_SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BLE_CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// 数据帧配置
#define PACKET_HEADER 0xAA    // 包头
#define PACKET_TAIL 0x55      // 包尾
#define zero_num    100
#define GRAVITY     9.8f
#define SENSOR_COUNT 1        // ESP32C3: 单压力传感器

// 数据帧结构：包头(1) + 压力数据(1) + 电池电量(1) + 包尾(1) = 4字节
#define DATA_LEN    SENSOR_COUNT * 1  // 1个uint8_t → 1字节
#define PACKET_LEN  1 + DATA_LEN + 1 + 1  // 包头(1) + 压力(1) + 电池(1) + 包尾(1) = 4字节
#define MIN_GRAVITY 0    // 调整最小值为0
#define MAX_GRAVITY 99   // 调整最大值为99

// ESP32C3 传感器引脚配置
int pressureSensorPin = 0;  // GPIO0 - 压力传感器（分压1/3）
int batteryMonitorPin = 1;  // GPIO1 - 电池电量监测

int zeroAD[SENSOR_COUNT] = {0};
BLECharacteristic *pCharacteristic;
bool deviceConnected = false;

// 压力转换参数（二次方程：ADC = -0.0521 × 力² + 25 × 力 - 40）
const float A_COEFF = -0.0521f;   // 二次项系数
const float B_COEFF = 25.0f;      // 一次项系数
const float C_CONST = -40.0f;     // 常数项

// 电池监测参数（分压1/3电路）
const float BATTERY_DIVIDER = 3.0f;  // 分压比：实际电压 = ADC读数 * 3
const float ADC_REF_VOLTAGE = 3.3f;  // ADC参考电压
const int ADC_MAX_VALUE = 4095;      // 12位ADC最大值

// 滤波参数
#define FILTER_WINDOW_SIZE 3   // 移动平均窗口大小
#define FILTER_ALPHA 0.85f       // 一阶低通滤波系数（0~1，越小越平滑）

// 滤波历史数据
int pressureHistory[FILTER_WINDOW_SIZE] = {0};
int historyIndex = 0;
uint8_t filteredPressure = 0;

// 传感器引脚数组
const int pressureSensorPins[] = {pressureSensorPin};

// BLE连接回调
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("蓝牙设备已连接");
    Serial.println("蓝牙传输：4字节二进制帧");
    Serial.println("帧结构：0xAA + 压力(1字节) + 电池(1字节) + 0x55");
    Serial.println("串口格式：十六进制显示完整帧（如 AA 15 64 55）");
  }
  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("蓝牙设备已断开，重启广播...");
    pServer->getAdvertising()->start();
  }
};

// 单个传感器零点校准
void calibrateAllZeros() {
  Serial.println("正在校准所有传感器零点...请确保传感器无压力！");
  delay(1500);
  for (int i = 0; i < SENSOR_COUNT; i++) {
    long sum = 0; // 使用long防止累加溢出
    int pin = pressureSensorPins[i];
    for (int j = 0; j < zero_num; j++) {
      sum += analogRead(pin);
      delayMicroseconds(200);
    }
    zeroAD[i] = sum / zero_num;
    Serial.printf("通道%d 零点AD值：%d\n", i+1, zeroAD[i]);
  }
  Serial.println("所有传感器零点校准完成！");
}

// 读取单个传感器AD值（去零）
int readSingleAD(int sensorIndex) {
  if (sensorIndex < 0 || sensorIndex >= SENSOR_COUNT) return 0;
  long sum = 0; // 使用long防止累加溢出
  int pin = pressureSensorPins[sensorIndex];
  for (int i = 0; i < 10; i++) {
    int raw = analogRead(pin) - zeroAD[sensorIndex];
    sum += (raw < 0) ? 0 : raw;
    delayMicroseconds(100);
  }
  return sum / 10;
}

// 读取单个传感器数据（转换为0~99的uint8_t），带组合滤波
uint8_t readSingleData(int sensorIndex) {
  // 1. 读取原始AD值
  int adValue = readSingleAD(sensorIndex);
  Serial.printf("AD:%d ", adValue);
  
  // 2. 无压力阈值判断
  if (adValue < 10) {
    filteredPressure = MIN_GRAVITY;
    return filteredPressure;
  }
  
  // 3. 使用二次方程反解计算压力值
  // 公式：ADC = -0.0521 × F² + 25 × F - 40
  // 反解：-0.0521 × F² + 25 × F - (40 + ADC) = 0
  float c = -(C_CONST + adValue);  // c = -(40 + ADC)
  float discriminant = B_COEFF * B_COEFF - 4 * A_COEFF * c;
  
  uint8_t rawPressure = MIN_GRAVITY;
  if (discriminant >= 0) {
    float sqrtDisc = sqrt(discriminant);
    // 取较小的正根（根据标定数据，力越大ADC越大）
    float force_N = (-B_COEFF + sqrtDisc) / (2 * A_COEFF);
    rawPressure = (uint8_t)constrain(round(force_N), MIN_GRAVITY, MAX_GRAVITY);
  }
  
  // 4. 组合滤波：移动平均 + 一阶低通
  
  // 4.1 移动平均滤波
  pressureHistory[historyIndex] = rawPressure;
  historyIndex = (historyIndex + 1) % FILTER_WINDOW_SIZE;
  
  long sum = 0;
  for (int i = 0; i < FILTER_WINDOW_SIZE; i++) {
    sum += pressureHistory[i];
  }
  int avgPressure = sum / FILTER_WINDOW_SIZE;
  
  // 4.2 一阶低通滤波
  filteredPressure = (uint8_t)(FILTER_ALPHA * avgPressure + (1 - FILTER_ALPHA) * filteredPressure);
  
  Serial.printf("原始:%d 滤波后:%d ", rawPressure, filteredPressure);
  
  return filteredPressure;
}

// 读取电池电压（返回电压×10的整数值，如4.2V返回42）
uint8_t readBatteryLevel() {
  long sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += analogRead(batteryMonitorPin);
    delayMicroseconds(100);
  }
  int adcValue = sum / 10;
  
  // 计算实际电压（分压1/3电路）
  float voltage = (float)adcValue / ADC_MAX_VALUE * ADC_REF_VOLTAGE * BATTERY_DIVIDER;
  
  // 电压范围限制（2.0V~4.5V）
  voltage = constrain(voltage, 2.0f, 4.5f);
  
  // 转换为电压×10的整数值（如4.2V → 42）
  uint8_t voltageScaled = (uint8_t)round(voltage * 10.0f);
  
  // 调试输出
  Serial.printf("电压:%.1fV(%02X) ", voltage, voltageScaled);
  
  return voltageScaled;
}

// 构建完整数据帧（包头 + 压力 + 电池 + 包尾）
void buildDataPacket(uint8_t *packetBuffer) {
  // 1. 写入包头
  packetBuffer[0] = PACKET_HEADER;
  
  // 2. 写入压力传感器数据
  uint8_t pressureData = readSingleData(0);
  packetBuffer[1] = pressureData;
  
  // 3. 写入电池电量数据
  uint8_t batteryData = readBatteryLevel();
  packetBuffer[2] = batteryData;
  
  // 4. 写入包尾
  packetBuffer[PACKET_LEN - 1] = PACKET_TAIL;
}

// 传感器初始化
void Init() {
  // 初始化压力传感器引脚
  pinMode(pressureSensorPin, INPUT);
  // 初始化电池监测引脚
  pinMode(batteryMonitorPin, INPUT);
  Serial.println("ESP32C3传感器引脚初始化完成");
  Serial.printf("压力传感器: GPIO%d, 电池监测: GPIO%d\n", pressureSensorPin, batteryMonitorPin);
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("启动...");
  
  Init();
  calibrateAllZeros();

  // BLE初始化（必须先init再setMTU）
  BLEDevice::init(BLE_DEVICE_NAME);
  
  // 扩展MTU（在init之后调用）
  BLEDevice::setMTU(64);
  
  Serial.println("BLE设备初始化完成");

  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  Serial.println("BLE服务器创建完成");

  BLEService *pService = pServer->createService(BLE_SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
                      BLE_CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ | 
                      BLECharacteristic::PROPERTY_NOTIFY
                    );
  pCharacteristic->addDescriptor(new BLE2902());
  Serial.println("BLE服务和特征创建完成");

  pService->start();
  Serial.println("BLE服务启动完成");

  // 配置广播
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // 手机连接首选
  pAdvertising->setMinPreferred(0x12);
  pAdvertising->start();

  Serial.println("BLE广播已启动，设备名称: " + String(BLE_DEVICE_NAME));
  Serial.println("等待蓝牙连接...");
}

void loop() {
  // 始终构建数据帧（无论蓝牙是否连接）
  uint8_t dataPacket[PACKET_LEN] = {0};
  buildDataPacket(dataPacket);

  // 串口始终输出（与蓝牙发送的数据格式一致）
  Serial.print("\n数据帧（4字节）：");
  for (int i = 0; i < PACKET_LEN; i++) {
    Serial.printf("%02X ", dataPacket[i]);
  }
  float batteryVoltage = (float)dataPacket[2] / 10.0f;
  Serial.printf(" -> 压力:%d, 电池:%.1fV", dataPacket[1], batteryVoltage);
  Serial.println();

  // 蓝牙发送（仅在连接时）
  if (deviceConnected) {
    pCharacteristic->setValue(dataPacket, PACKET_LEN);
    pCharacteristic->notify();
    Serial.println("（蓝牙已发送）");
  }
  
  delay(500);
}