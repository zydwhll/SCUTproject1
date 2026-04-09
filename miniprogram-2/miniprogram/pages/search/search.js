/**
 * 搜索页逻辑 - 医护端
 * 功能：姓名模糊搜索、展示结果列表、跳转详情页
 */
// 改用兼容的 require 语法导入配置
const config = require('../../app.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    searchKey: '', // 搜索关键词
    list: [], // 搜索结果列表
    loading: false, // 加载状态
    hasSearched: false, // 是否触发过搜索
    darkMode: false // 深色模式标识
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 初始化云环境
    wx.cloud.init({
      env: config.envId,
      traceUser: true
    });
    // 检测深色模式
    this.checkDarkMode();
    
    // 关键修复1：初始化数据库实例（全局数据库 + 集合）
    this.db = wx.cloud.database(); // 数据库根实例（用于调用 RegExp）
    this.usersCollection = this.db.collection('users'); // 集合实例（用于查询）
  },

  /**
   * 检测系统深色模式
   */
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

  /**
   * 输入框内容变化监听
   * @param {Object} e 输入事件对象
   */
  onInputChange(e) {
    this.setData({
      searchKey: e.detail.value.trim()
    });
  },

  /**
   * 执行搜索操作
   */
  doSearch() {
    const { searchKey } = this.data;
    if (!searchKey) {
      wx.showToast({ title: '请输入搜索关键词', icon: 'none' });
      return;
    }

    // 设置加载状态
    this.setData({ loading: true, hasSearched: true });

    // 关键修复2：使用 this.db 调用 RegExp，使用 this.usersCollection 执行查询
    this.usersCollection.where({
      name: this.db.RegExp({ // 此处改为 this.db，而非全局 db
        regexp: searchKey,
        options: 'i' // 不区分大小写
      })
    }).get({
      success: (res) => {
        this.setData({
          list: res.data,
          loading: false
        });
      },
      fail: (err) => {
        this.setData({ loading: false });
        wx.showToast({ title: '数据加载失败', icon: 'error' });
        console.error('搜索失败：', err);
        
        // 重试机制：失败后重试1次
        this.retrySearch(searchKey);
      }
    });
  },

  /**
   * 搜索重试
   * @param {String} key 搜索关键词
   */
  retrySearch(key) {
    wx.showLoading({ title: '重试中...', mask: true });
    // 关键修复3：重试时同样使用 this.db 和 this.usersCollection
    this.usersCollection.where({
      name: this.db.RegExp({ // 此处改为 this.db
        regexp: key,
        options: 'i'
      })
    }).get({
      success: (res) => {
        wx.hideLoading();
        this.setData({
          list: res.data,
          loading: false
        });
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '重试失败，请稍后再试', icon: 'error' });
        console.error('搜索重试失败：', err);
      }
    });
  },

  /**
   * 跳转至详情页
   * @param {Object} e 点击事件对象
   */
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  }
});