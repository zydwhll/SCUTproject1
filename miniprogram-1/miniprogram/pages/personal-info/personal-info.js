// pages/personal-info/personal-info.js
import { timerManager } from '../../utils/timerManager';

Page({
  data: {
    title: '压力显示小程序',
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

  async formSubmit(e) {
    // 1. 收集并验证表单数据
    const userInfo = e.detail.value;
    const { name, age, weight, height, boneAge } = userInfo;
    if (!name || !age || !weight || !height || !boneAge) {
      wx.showToast({ title: '所有信息不能为空！', icon: 'none', duration: 2000 });
      return;
    }

    try {
      // 2. 数据库写入逻辑（保留不变）
      const db = wx.cloud.database();
      const usersCollection = db.collection('users');
      const openIdRes = await wx.cloud.callFunction({ name: 'getOpenid' });
      const openId = openIdRes.result.openid;

      await usersCollection.doc(openId).set({
        data: {
          name,
          age,
          weight,
          height,
          boneAge,
          updateTime: db.serverDate()
        }
      });

      // 同步全局数据
      getApp().globalData.userInfo = userInfo;
      wx.showToast({ title: '信息保存成功', icon: 'success', duration: 1500 });

      // 核心修改：tabBar页面必须用 switchTab 跳转
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/show-info/show-info', // 必须是tabBar配置的路径
          fail: (err) => {
            console.error('tabBar跳转失败', err);
            wx.showToast({ title: '跳转失败：' + err.errMsg, icon: 'none' });
          }
        });
      }, 1500);

    } catch (err) {
      console.error('用户信息修改失败', err);
      wx.showToast({ title: '信息保存失败：' + err.errMsg, icon: 'none' });
    }
  },

  // 测试tabBar跳转的按钮方法（可选）
  testJump() {
    wx.switchTab({
      url: '/pages/show-info/show-info',
      success: () => wx.showToast({ title: '跳转成功！', icon: 'success' }),
      fail: (err) => {
        wx.showToast({ title: '跳转失败：' + err.errMsg, icon: 'none' });
        console.log('tabBar跳转失败原因：', err);
      }
    });
  }
})