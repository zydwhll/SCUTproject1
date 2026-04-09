/**
 * 首页逻辑 - 医护端
 * 功能：授权登录、显示日期时间、祝福语、跳转搜索页
 */
const config = require('../../app.js');

Page({
  data: {
    currentDatetime: '',
    greetingText: config.GREETING,
    darkMode: false
  },

  // 新增：定时器实例统一管理
  timer: null,

  onLoad(options) {
    // 初始化云环境
    if (!wx.cloud) {
      wx.showToast({ title: '当前微信版本不支持云开发', icon: 'error' });
      return;
    }
    wx.cloud.init({
      env: config.envId,
      traceUser: true
    });

    this.wxLogin();
    this.checkDarkMode();
    this.updateDatetime();

    // 修复：定时器赋值前先清空旧定时器（防止重复创建）
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      // 防护：执行前先判断页面是否已销毁（通过this是否存在）
      if (!this) return;
      this.updateDatetime();
    }, 1000);
  },

  // 修复1：onUnload中强制清理定时器
  onUnload() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null; // 置空，避免残留引用
    }
  },

  // 修复2：新增onHide生命周期（页面隐藏时也清理定时器）
  onHide() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  // 修复3：页面显示时重新创建定时器（保证返回首页时时间仍更新）
  onShow() {
    if (!this.timer) {
      this.updateDatetime();
      this.timer = setInterval(() => {
        if (!this) return;
        this.updateDatetime();
      }, 1000);
    }
  },

  wxLogin() {
    wx.login({
      success: (res) => {
        if (res.code) {
          console.log('登录凭证code：', res.code);
        } else {
          wx.showToast({ title: '登录失败：' + res.errMsg, icon: 'error' });
        }
      },
      fail: (err) => {
        wx.showToast({ title: '登录接口调用失败', icon: 'error' });
        console.error('登录失败：', err);
      }
    });
  },

  checkDarkMode() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      const darkMode = systemInfo.system.toLowerCase().includes('dark') || 
                       (systemInfo.theme && systemInfo.theme === 'dark');
      this.setData({ darkMode });
    } catch (err) {
      console.error('检测深色模式失败：', err);
    }
  },

  updateDatetime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = this.formatNum(now.getMonth() + 1);
    const day = this.formatNum(now.getDate());
    const hour = this.formatNum(now.getHours());
    const minute = this.formatNum(now.getMinutes());
    const datetime = `${year}-${month}-${day} ${hour}:${minute}`;
    // 防护：设置数据前先判断页面是否存活
    if (this && this.setData) {
      this.setData({ currentDatetime: datetime });
    }
  },

  formatNum(num) {
    return num < 10 ? `0${num}` : num;
  },

  goToSearch() {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  }
});