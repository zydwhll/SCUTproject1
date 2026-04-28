// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // env 参数说明：
      // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会请求到哪个云环境的资源
      // 此处请填入环境 ID, 环境 ID 可在微信开发者工具右上顶部工具栏点击云开发按钮打开获取
      env: "cloud1-1g6svufkdba1d925",
      // 初始化蓝牙对象，避免访问 undefined
      bluetooth: {
        // UI 开关状态（“蓝牙连接中”），仅在用户手动切换开关时改变
        switchOn: false,
        connected: false,    // 默认未连接
        deviceId: '',        // 蓝牙设备ID
        name: '',            // 蓝牙设备名称
        serviceId: '',       // 蓝牙服务ID
        characteristicId: '',// 蓝牙特征值ID
        pressureData: [],    // 压力数据数组（兼容旧页面）
        pressure: null,      // 最新压力值（十进制）
        battery: null        // 最新电量（0~100）
      },
      userInfo: {}           // 补充初始化用户信息，避免其他页面报错
    };

    // 监听蓝牙连接状态变化：断开时同步全局状态（用于顶部电量条等全局显示）
    if (wx && typeof wx.onBLEConnectionStateChange === 'function') {
      wx.onBLEConnectionStateChange(res => {
        const bluetooth = this.globalData && this.globalData.bluetooth;
        if (!bluetooth) return;

        if (!res.connected) {
          bluetooth.connected = false;
          bluetooth.deviceId = '';
          bluetooth.name = '';
          bluetooth.serviceId = '';
          bluetooth.characteristicId = '';
          bluetooth.pressure = null;
          bluetooth.battery = null;
          bluetooth.pressureData = [];
        } else {
          bluetooth.connected = true;
        }
      });
    }

    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
  },
});
