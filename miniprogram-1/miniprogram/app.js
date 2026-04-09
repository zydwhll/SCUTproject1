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
        connected: false,    // 默认未连接
        deviceId: '',        // 蓝牙设备ID
        name: '',            // 蓝牙设备名称
        serviceId: '',       // 蓝牙服务ID
        characteristicId: '',// 蓝牙特征值ID
        pressureData: []     // 压力数据数组
      },
      userInfo: {}           // 补充初始化用户信息，避免其他页面报错
    };
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