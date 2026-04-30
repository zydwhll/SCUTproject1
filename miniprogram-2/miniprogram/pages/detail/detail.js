/**
 * 详情页逻辑 - 医护端
 * 功能：展示患者完整数据、历史记录、导出Excel
 */
import { envId } from '../../app.js';
const config = require('../../app.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    detail: {}, // 患者详情数据
    darkMode: false, // 深色模式标识
    exportLoading: false, // 导出按钮加载状态
    showChart: false // 是否显示折线图
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '参数错误', icon: 'error' });
      wx.navigateBack();
      return;
    }

    // 初始化云环境
    wx.cloud.init({
      env: envId,
      traceUser: true
    });

    // 检测深色模式
    this.checkDarkMode();

    // 存储患者ID
    this.patientId = options.id;

    // 获取患者详情
    this.getDetail(options.id);
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
   * 获取患者详情数据
   * @param {String} id 患者ID
   */
  getDetail(id) {
    wx.showLoading({ title: '加载中...', mask: true });
    const db = wx.cloud.database().collection('users');
    
    db.doc(id).get({
      success: (res) => {
        wx.hideLoading();
        this.setData({
          detail: res.data
        });
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '数据加载失败', icon: 'error' });
        console.error('获取详情失败：', err);
        
        // 重试机制：失败后重试1次
        this.retryGetDetail(id);
      }
    });
  },

  /**
   * 重试获取详情
   * @param {String} id 患者ID
   */
  retryGetDetail(id) {
    const db = wx.cloud.database().collection('users');
    db.doc(id).get({
      success: (res) => {
        this.setData({
          detail: res.data
        });
      },
      fail: (err) => {
        wx.showToast({ title: '重试失败，请稍后再试', icon: 'error' });
        console.error('获取详情重试失败：', err);
        wx.navigateBack();
      }
    });
  },

  /**
   * 导出Excel事件处理函数
   */
  onExportExcel() {
    if (!this.patientId) {
      wx.showToast({ title: '患者ID异常，无法导出', icon: 'error' });
      return;
    }

    // 设置导出加载状态
    this.setData({ exportLoading: true });

    try {
      // 调用云函数生成Excel
      wx.cloud.callFunction({
        env: config.envId,
        name: 'exportExcel',
        data: {
          id: this.patientId // 传递患者ID
        },
        success: (res) => {
          this.setData({ exportLoading: false });
          
          // 校验云函数返回结果
          if (!res.result || !res.result.success) {
            wx.showToast({ 
              title: res.result?.errMsg || '生成Excel失败', 
              icon: 'error' 
            });
            return;
          }

          // 获取文件ID并下载
          this.downloadExcel(res.result.fileID);
        },
        fail: (err) => {
          this.setData({ exportLoading: false });
          wx.showToast({ title: '调用导出接口失败', icon: 'error' });
          console.error('调用exportExcel云函数失败：', err);
        }
      });
    } catch (err) {
      this.setData({ exportLoading: false });
      wx.showToast({ title: '导出异常，请重试', icon: 'error' });
      console.error('导出Excel异常：', err);
    }
  },

  /**
   * 下载Excel文件
   * @param {String} fileID 云存储文件ID
   */
  downloadExcel(fileID) {
    wx.showLoading({ title: '下载中...', mask: true });

    // 获取文件临时链接
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: (tempRes) => {
        const tempFileURL = tempRes.fileList[0].tempFileURL;
        if (!tempFileURL) {
          wx.hideLoading();
          wx.showToast({ title: '获取下载链接失败', icon: 'error' });
          return;
        }

        // 下载文件
        wx.downloadFile({
          url: tempFileURL,
          success: (downRes) => {
            wx.hideLoading();
            // 校验下载结果
            if (downRes.statusCode !== 200) {
              wx.showToast({ title: '文件下载失败', icon: 'error' });
              return;
            }

            // 尝试打开Excel文件
            wx.openDocument({
              filePath: downRes.tempFilePath,
              fileType: 'xlsx',
              showMenu: true, // 显示右上角菜单（支持保存到手机）
              success: () => {
                wx.showToast({ title: 'Excel打开成功', icon: 'success' });
              },
              fail: (openErr) => {
                // 打开失败时提示用户
                wx.showModal({
                  title: '提示',
                  content: 'Excel文件已下载，可前往微信"我-收藏-文件"中查看',
                  showCancel: false,
                  confirmText: '知道了'
                });
                console.error('打开Excel失败：', openErr);
              }
            });
          },
          fail: (downErr) => {
            wx.hideLoading();
            wx.showToast({ title: '文件下载失败', icon: 'error' });
            console.error('下载Excel失败：', downErr);
          }
        });
      },
      fail: (tempErr) => {
        wx.hideLoading();
        wx.showToast({ title: '获取临时链接失败', icon: 'error' });
        console.error('获取临时链接失败：', tempErr);
      }
    });
  },

  /**
   * 显示/隐藏折线图
   */
  onShowChart: function() {
    var that = this;
    var showChart = that.data.showChart;
    var detail = that.data.detail;
    
    if (!detail.timerRecords || detail.timerRecords.length === 0) {
      wx.showToast({ title: '暂无治疗记录', icon: 'none' });
      return;
    }

    that.setData({
      showChart: !showChart
    });

    if (!showChart) {
      setTimeout(function() {
        that.drawLineChart();
      }, 200);
    }
  },

  /**
   * 绘制折线图
   */
  drawLineChart: function() {
    var that = this;
    var detail = that.data.detail;
    var records = detail.timerRecords;
    
    if (!records || records.length === 0) {
      return;
    }

    var ctx = wx.createCanvasContext('lineChart');
    var width = 300;
    var height = 180;
    var paddingTop = 30;
    var paddingRight = 15;
    var paddingBottom = 40;
    var paddingLeft = 45;
    var chartWidth = width - paddingLeft - paddingRight;
    var chartHeight = height - paddingTop - paddingBottom;

    var dataArray = [];
    for (var i = 0; i < records.length; i++) {
      var item = records[i];
      dataArray.push({
        x: parseInt(item.count),
        y: parseFloat(item.duration) * parseFloat(item.pressure)
      });
    }
    
    dataArray.sort(function(a, b) {
      return a.x - b.x;
    });

    var yMax = 0;
    var yMin = 99999;
    for (var j = 0; j < dataArray.length; j++) {
      var val = dataArray[j].y;
      if (val > yMax) yMax = val;
      if (val < yMin) yMin = val;
    }
    yMax = yMax * 1.1;
    yMin = yMin * 0.9;
    var yRange = yMax - yMin;
    if (yRange <= 0) yRange = 1;
    var pointCount = dataArray.length;

    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, width, height);

    ctx.setStrokeStyle('#ddd');
    ctx.setLineWidth(1);
    
    for (var k = 0; k <= 4; k++) {
      var gridY = paddingTop + (chartHeight / 4) * k;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, gridY);
      ctx.lineTo(width - paddingRight, gridY);
      ctx.stroke();
    }

    for (var m = 0; m <= pointCount; m++) {
      var gridX = paddingLeft + (chartWidth / pointCount) * m;
      ctx.beginPath();
      ctx.moveTo(gridX, paddingTop);
      ctx.lineTo(gridX, height - paddingBottom);
      ctx.stroke();
    }

    ctx.setFillStyle('#666');
    ctx.setFontSize(8);
    
    for (var n = 0; n <= 4; n++) {
      var yVal = paddingTop + (chartHeight / 4) * n;
      var value = Math.round(yMax - (yRange / 4) * n);
      ctx.fillText(value.toString(), 5, yVal + 3);
    }

    for (var p = 0; p < dataArray.length; p++) {
      var point = dataArray[p];
      var xPos = paddingLeft + (chartWidth / pointCount) * p + (chartWidth / pointCount) / 2;
      ctx.fillText(point.x.toString(), xPos - 6, height - 10);
    }

    ctx.setFillStyle('#666');
    ctx.setFontSize(9);
    ctx.fillText('次数', width / 2 - 12, height - 5);
    
    ctx.save();
    ctx.translate(8, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('指标值', -height / 2 + 20, 0);
    ctx.restore();

    ctx.setStrokeStyle('#0088ff');
    ctx.setLineWidth(2);
    ctx.beginPath();
    
    for (var q = 0; q < dataArray.length; q++) {
      var pt = dataArray[q];
      var xPosition = paddingLeft + (chartWidth / pointCount) * q + (chartWidth / pointCount) / 2;
      var yPosition = paddingTop + ((yMax - pt.y) / yRange) * chartHeight;
      
      if (q === 0) {
        ctx.moveTo(xPosition, yPosition);
      } else {
        ctx.lineTo(xPosition, yPosition);
      }
    }
    ctx.stroke();

    ctx.setFillStyle('#0088ff');
    for (var r = 0; r < dataArray.length; r++) {
      var pointItem = dataArray[r];
      var posX = paddingLeft + (chartWidth / pointCount) * r + (chartWidth / pointCount) / 2;
      var posY = paddingTop + ((yMax - pointItem.y) / yRange) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(posX, posY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.draw();
  }

});