/**
 * 全局计时管理器，处理计时逻辑、本地存储、格式转换
 * 单例模式，全局唯一
 */
class TimerManager {
  constructor() {
    this.timerId = null; // 计时定时器
    this.startTime = wx.getStorageSync('timerStartTime') || null; // 本地存储的开始时间戳
    this.currentDuration = 0; // 当前计时时长（秒）
    this.isRunning = !!this.startTime; // 是否正在计时

    // 若有历史开始时间，恢复计时时长并重启定时器
    if (this.startTime) {
      const now = Date.now();
      this.currentDuration = Math.floor((now - this.startTime) / 1000);
      this.startTimer();
    }
  }

  // 开始计时
  startTimer() {
    if (this.isRunning) return;
    this.startTime = Date.now() - (this.currentDuration * 1000);
    wx.setStorageSync('timerStartTime', this.startTime);
    this.isRunning = true;

    // 每秒更新计时时长
    this.timerId = setInterval(() => {
      this.currentDuration += 1;
    }, 1000);
  }

  // 停止计时，返回计时结果
  stopTimer() {
    if (!this.isRunning) return null;
    clearInterval(this.timerId);
    this.timerId = null;
    this.isRunning = false;
    wx.removeStorageSync('timerStartTime'); // 清除本地开始时间

    // 转换为分钟（四舍五入）
    const totalMinutes = Math.round(this.currentDuration / 60);
    const result = {
      duration: totalMinutes, // 分钟数
      seconds: this.currentDuration, // 秒数（备用）
      createTime: this.formatDateTime(new Date()) // 格式化创建时间
    };

    this.currentDuration = 0; // 重置当前时长
    return result;
  }

  // 格式化时间为 MM:SS（如 01:25）
  formatMMSS() {
    const minutes = Math.floor(this.currentDuration / 60);
    const seconds = this.currentDuration % 60;
    return `${this.padZero(minutes)}:${this.padZero(seconds)}`;
  }

  // 数字补零（小于10时补0）
  padZero(num) {
    return num.toString().padStart(2, '0');
  }

  // 格式化日期时间为 YYYY-MM-DD HH:MM
  formatDateTime(date) {
    const year = date.getFullYear();
    const month = this.padZero(date.getMonth() + 1);
    const day = this.padZero(date.getDate());
    const hour = this.padZero(date.getHours());
    const minute = this.padZero(date.getMinutes());
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }

  // 获取当前计时状态（是否运行、格式化时间、总秒数）
  getStatus() {
    return {
      isRunning: this.isRunning,
      formattedTime: this.formatMMSS(),
      totalSeconds: this.currentDuration
    };
  }

  // 销毁定时器（页面卸载时调用）
  destroy() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}

// 导出单例实例，全局共享
export const timerManager = new TimerManager();