// pages/grid/grid.js
import { timerManager } from '../../utils/timerManager';

Page({
  data: {
    gridData1: [],  // 从蓝牙接收的数组
    gridData2: [],  // 颜色映射数组
    title:'压力显示小程序',
    timerFormatted: '00:00' // 计时显示
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 初始化计时显示
    this.updateTimerStatus();
    // 每秒更新
    this.timerUpdateInterval = setInterval(() => {
      this.updateTimerStatus();
    }, 1000);
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    clearInterval(this.timerUpdateInterval);
  },

  /**
   * 更新计时显示状态
   */
  updateTimerStatus() {
    const status = timerManager.getStatus();
    this.setData({
      timerFormatted: status.formattedTime
    });
  },

  onLoad() {
    const app = getApp();
    // 初始化时获取当前压力数据
    this.setData({
      gridData1: app.globalData.bluetooth.pressureData
    });
    this.generateGridData2();

    // 监听全局数据变化（每300ms检查一次）
    this.dataListener = setInterval(() => {
      const newData = app.globalData.bluetooth.pressureData;
      if (JSON.stringify(newData) !== JSON.stringify(this.data.gridData1)) {
        this.setData({ gridData1: newData });
        this.generateGridData2();
      }
    }, 300);
  },

  onUnload() {
    // 页面卸载时清除监听
    clearInterval(this.dataListener);
  },

  generateGridData2() {
    const { gridData1 } = this.data;
    if (!gridData1.length) return;

    const gridData2 = gridData1.map(num => {
      if (num < 10) return 2;         // 蓝色
      else if (num > 20) return 1;    // 红色
      else return 0;                  // 绿色
    });
    this.setData({ gridData2 });
  }
});