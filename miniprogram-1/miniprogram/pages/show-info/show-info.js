// pages/show-info/show-info.js
import { timerManager } from '../../utils/timerManager';

const app = getApp();
Page({
  data: {
    title: '压力显示小程序',
    userInfo: {},
    timerFormatted: '00:00'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.updateTimerStatus();
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
   * 更新计时显示
   */
  updateTimerStatus() {
    const status = timerManager.getStatus();
    this.setData({
      timerFormatted: status.formattedTime
    });
  },

  // 页面加载时获取最新数据
  async onLoad() {
    await this.getUserInfoFromDB();
  },

  // 页面每次显示时刷新数据（比如从编辑页返回时）
  async onShow() {
    await this.getUserInfoFromDB();
  },

  // 从云数据库获取用户最新信息（自动包含name字段）
  async getUserInfoFromDB() {
    try {
      // 1. 获取用户OpenID
      const openIdRes = await wx.cloud.callFunction({ name: 'getOpenid' });
      const openId = openIdRes.result.openid;

      // 2. 从数据库读取数据（包含新增的name字段）
      const db = wx.cloud.database();
      const res = await db.collection('users').doc(openId).get();

      // 3. 更新页面数据
      if (res.data) {
        this.setData({ userInfo: res.data });
        app.globalData.userInfo = res.data; // 同步到全局
      } else {
        this.setData({ userInfo: app.globalData.userInfo });
      }

    } catch (err) {
      console.error('读取用户信息失败', err);
      this.setData({ userInfo: app.globalData.userInfo });
      wx.showToast({ title: '读取信息失败，显示本地缓存', icon: 'none' });
    }
  },

  // 跳转到编辑页
  toEdit() {
    wx.navigateTo({ url: '/pages/personal-info/personal-info' });
  }
})