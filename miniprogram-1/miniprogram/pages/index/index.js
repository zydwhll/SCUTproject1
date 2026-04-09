// index.js
// 引入全局计时管理器
import { timerManager } from '../../utils/timerManager';

Page({
  data: {
    title:'压力显示小程序',
    timerFormatted: '00:00', // 格式化的计时显示
    isTimerRunning: false,    // 计时是否运行
    bluetoothmode: false, // 蓝牙开关状态
    showDeviceList: false // 是否显示设备列表（点击开始扫描后为true）
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 初始化计时状态
    this.updateTimerStatus();
    // 每秒更新计时显示
    this.timerUpdateInterval = setInterval(() => {
      this.updateTimerStatus();
    }, 1000);
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 清除定时器，避免内存泄漏
    clearInterval(this.timerUpdateInterval);
  },

  /**
   * 更新计时状态显示
   */
  updateTimerStatus() {
    const status = timerManager.getStatus();
    this.setData({
      timerFormatted: status.formattedTime,
      isTimerRunning: status.isRunning
    });
  },

  /**
   * 计时按钮点击事件（开始/停止）
   */
  handleTimerClick() {
    const { isTimerRunning } = this.data;
    if (!isTimerRunning) {
      // 开始计时
      timerManager.startTimer();
    } else {
      // 停止计时并保存记录
      const timerResult = timerManager.stopTimer();
      if (timerResult) {
        this.saveTimerRecordToCloud(timerResult);
      }
    }
    // 更新按钮和显示状态
    this.updateTimerStatus();
  },

  /**
   * 将计时记录保存到云数据库users集合
   */
  async saveTimerRecordToCloud(timerResult) {
    try {
      wx.showLoading({ title: '保存记录中...' });

      // 1. 调用云函数获取用户openid
      const loginRes = await wx.cloud.callFunction({
        name: 'login',
        data: {}
      });
      const openid = loginRes.result.openid;

      // 2. 初始化云数据库
      const db = wx.cloud.database();
      const usersCollection = db.collection('users');

      // 3. 查询用户是否已有记录
      const userRes = await usersCollection.where({
        _openid: openid
      }).get();

      let newCount = 1; // 默认第一条记录
      // 4. 已有用户：更新记录（push新记录，count自动递增）
      if (userRes.data.length > 0) {
        const user = userRes.data[0];
        // 计算新的count（取最后一条的count+1，无则为1）
        newCount = user.timerRecords && user.timerRecords.length > 0 
          ? user.timerRecords[user.timerRecords.length - 1].count + 1 
          : 1;
        // 更新用户记录
        await usersCollection.doc(user._id).update({
          data: {
            timerRecords: db.command.push({
              count: newCount,
              duration: timerResult.duration,
              createTime: timerResult.createTime
            })
          }
        });
      } else {
        // 5. 新用户：创建记录
        await usersCollection.add({
          data: {
            _openid: openid,
            timerRecords: [{
              count: newCount,
              duration: timerResult.duration,
              createTime: timerResult.createTime
            }]
          }
        });
      }

      wx.hideLoading();
      wx.showToast({ title: '记录保存成功', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
      console.error('保存计时记录失败：', error);
    }
  },

  
  onShow() {
    // 页面显示时同步全局蓝牙状态
    const app = getApp();
    this.setData({
      bluetoothmode: app.globalData.bluetooth.connected
    });
  },

  // 蓝牙开关切换（仅改变状态，不扫描）
  bluetoothChange(e) {
    const isChecked = e.detail.value;
    const app = getApp();
    
    // 关闭开关：断开蓝牙 + 隐藏扫描按钮和设备列表
    if (!isChecked) {
      this.setData({ 
        bluetoothmode: false,
        showDeviceList: false 
      });
      
      if (app.globalData.bluetooth.connected) {
        wx.closeBLEConnection({
          deviceId: app.globalData.bluetooth.deviceId,
          success: () => {
            app.globalData.bluetooth.connected = false;
            wx.showToast({ title: "已断开蓝牙连接", icon: "none" });
          },
          fail: (err) => {
            console.log("断开蓝牙失败", err);
            wx.showToast({ title: "断开蓝牙失败", icon: "none" });
          }
        });
      }
    } 
    // 打开开关：仅切换状态为“蓝牙连接中”，不执行扫描
    else {
      this.setData({ 
        bluetoothmode: true,
        showDeviceList: false // 初始不显示设备列表
      });
      wx.showToast({ title: "请点击「开始扫描」查找设备", icon: "none" });
    }
  },

  // 点击“开始扫描”按钮：先显示组件，再获取实例执行扫描
  startScan() {
    // 第一步：先显示组件（触发渲染）
    this.setData({ showDeviceList: true }, () => {
      // 第二步：组件渲染完成后，再获取实例
      const bluetoothComp = this.selectComponent('#bluetooth-comp');
      if (!bluetoothComp) {
        wx.showToast({ title: "组件加载失败，请重试", icon: "none" });
        return;
      }

      // 第三步：执行蓝牙初始化和扫描
      bluetoothComp.openBluetoothAdapter();
      wx.showToast({ title: "开始扫描蓝牙设备...", icon: "none" });
    });
  }
})