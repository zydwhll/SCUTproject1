// components/bluetooth-comp/index.js
function inArray(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}

// 将字符串转为 ArrayBuffer
function str2ab(str) {
  let buf = new ArrayBuffer(str.length);
  let bufView = new Uint8Array(buf);
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

Component({
  data: {
    devices: [],
    connected: false,
    chs: [],
    name: ''
  },

  lifetimes: {
    attached() {
      // 初始化时同步全局连接状态
      const app = getApp();
      this.setData({
        connected: app.globalData.bluetooth.connected,
        name: app.globalData.bluetooth.name || ''
      });
    }
  },

  methods: {
    /* 初始化蓝牙模块 */
    openBluetoothAdapter() {
      // 先关闭蓝牙模块再开启 防止断开后点连接连接不上
      this.closeBluetoothAdapter();

      wx.openBluetoothAdapter({
        success: response => {
          console.log("初始化蓝牙模块成功：openBluetoothAdapter", response);
          this.startBluetoothDevicesDiscovery();
        },
        fail: err => {
          if (err.errCode === 10001) {
            /* 监听蓝牙适配器状态变化事件 */
            wx.onBluetoothAdapterStateChange(res => {
              console.log("监听蓝牙适配器状态变化事件：onBluetoothAdapterStateChange", res);
              res.available && this.startBluetoothDevicesDiscovery();
            });
          }
        },
      });
    },

    /* 获取本机蓝牙适配器状态 */
    getBluetoothAdapterState() {
      wx.getBluetoothAdapterState({
        success: res => {
          console.log("getBluetoothAdapterState", res);
          if (res.discovering) {
            // 是否正在搜索设备
            this.onBluetoothDeviceFound();
          } else if (res.available) {
            // 蓝牙适配器是否可用
            this.startBluetoothDevicesDiscovery();
          }
        },
      });
    },

    /* 开始搜寻附近的蓝牙外围设备 */
    startBluetoothDevicesDiscovery() {
      // 开始扫描参数
      if (this._discoveryStarted) return;

      this._discoveryStarted = true;
      wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: true,
        success: response => {
          console.log("开始搜寻附近的蓝牙外围设备：startBluetoothDevicesDiscovery", response);
          this.onBluetoothDeviceFound();
        },
        fail: err => {
          console.log("搜索设备失败", err);
          wx.showToast({ title: "搜索设备失败", icon: "none" });
        },
      });
    },

    /* 停止搜寻附近的蓝牙外围设备。*/
    stopBluetoothDevicesDiscovery() {
      console.log("停止搜寻附近的蓝牙外围设备");
      wx.stopBluetoothDevicesDiscovery();
    },

    /* 监听搜索到新设备的事件 */
    onBluetoothDeviceFound() {
      wx.onBluetoothDeviceFound(res => {
        res.devices.forEach(device => {
          if (!device.name && !device.localName) {
            return;
          }

          const foundDevices = this.data.devices;
          const idx = inArray(foundDevices, "deviceId", device.deviceId);
          const data = {};
          if (idx === -1) {
            data[`devices[${foundDevices.length}]`] = device;
          } else {
            data[`devices[${idx}]`] = device;
          }
          this.setData(data);
        });
      });
    },

    /* 连接蓝牙低功耗设备。*/
    createBLEConnection(e) {
      const ds = e.currentTarget.dataset;
      const deviceId = ds.deviceId;
      const name = ds.name;
      const app = getApp();

      wx.createBLEConnection({
        deviceId,
        success: () => {
          // 更新全局连接状态
          app.globalData.bluetooth.connected = true;
          app.globalData.bluetooth.deviceId = deviceId;
          app.globalData.bluetooth.name = name;
          app.globalData.bluetooth.serviceId = '';
          app.globalData.bluetooth.characteristicId = '';
          app.globalData.bluetooth.pressureData = [];
          app.globalData.bluetooth.pressure = null;
          app.globalData.bluetooth.battery = null;
          this.setData({ connected: true, name, deviceId });
          wx.showToast({ title: "连接蓝牙设备成功", icon: "none" });
          this.getBLEDeviceServices(deviceId);
        },
        fail: e => {
          console.log("连接失败", e.errMsg);
          wx.showToast({ title: "连接失败,错误信息: " + e.errMsg, icon: "none" });
        },
      });
      // 停止搜寻蓝牙设备
      this.stopBluetoothDevicesDiscovery();
    },

    /* 获取蓝牙低功耗设备所有服务 (service) */
    getBLEDeviceServices(deviceId) {
      wx.getBLEDeviceServices({
        deviceId,
        success: res => {
          for (let i = 0; i < res.services.length; i++) {
            if (res.services[i].isPrimary) {
              this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid);
              return;
            }
          }
        },
      });
    },

    // 获取特征值后更新全局信息
    getBLEDeviceCharacteristics(deviceId, serviceId) {
      const app = getApp();
      wx.getBLEDeviceCharacteristics({
        deviceId,
        serviceId,
        success: res => {
          for (let i = 0; i < res.characteristics.length; i++) {
            let item = res.characteristics[i];
            // 记录可读写的特征值到全局
            if (item.properties.write) {
              app.globalData.bluetooth.serviceId = serviceId;
              app.globalData.bluetooth.characteristicId = item.uuid;
            }
            // 监听通知
            if (item.properties.notify || item.properties.indicate) {
              wx.notifyBLECharacteristicValueChange({
                deviceId,
                serviceId,
                characteristicId: item.uuid,
                state: true,
              });
            }
          }
        },
      });

      // 监听蓝牙数据（协议：AA pressure battery 55，共4字节；非4字节直接忽略）
      wx.onBLECharacteristicValueChange(characteristic => {
        const uint8Array = new Uint8Array(characteristic.value);
        if (uint8Array.length !== 4) return;

        const HEAD = 0xAA;
        const TAIL = 0x55;
        if (uint8Array[0] !== HEAD || uint8Array[3] !== TAIL) return;

        const pressure = uint8Array[1];
        const battery = uint8Array[2];

        app.globalData.bluetooth.pressure = pressure;
        app.globalData.bluetooth.battery = battery;
        // 兼容旧页面：仍然保留压力数组
        app.globalData.bluetooth.pressureData = [pressure];
      });
    },

    /* 向蓝牙低功耗设备特征值中写入二进制数据 */
    writeBLECharacteristicValue(jsonStr) {
      let arrayBufferValue = str2ab(jsonStr);
      console.log("发送数据给蓝牙", "原始字符串", jsonStr, "转换arrayBuffer", arrayBufferValue);
      const app = getApp();

      wx.writeBLECharacteristicValue({
        deviceId: app.globalData.bluetooth.deviceId,
        serviceId: app.globalData.bluetooth.serviceId,
        characteristicId: app.globalData.bluetooth.characteristicId,
        value: arrayBufferValue, // 只能发送arrayBuffer类型数据
        success(res) {
          console.log("消息发送成功", res.errMsg);
          wx.showToast({ title: "消息发送成功", icon: "none" });
        },
        fail(e) {
          console.log("发送消息失败", e);
          wx.showToast({ title: "发送消息失败,错误信息: " + e.errMsg, icon: "none" });
        },
      });
    },
    
    closeBluetoothAdapter() {
      console.log("关闭蓝牙模块");
      wx.closeBluetoothAdapter();
      this._discoveryStarted = false;
    },

    // 断开连接时更新全局状态
    closeBLEConnection() {
      const app = getApp();
      wx.closeBLEConnection({ 
        deviceId: app.globalData.bluetooth.deviceId,
        success: () => {
          app.globalData.bluetooth.connected = false;
          app.globalData.bluetooth.pressure = null;
          app.globalData.bluetooth.battery = null;
          app.globalData.bluetooth.pressureData = [];
          this.setData({ connected: false });
          wx.showToast({ title: "已断开连接", icon: "none" });
        }
      });
    }
  }
});
