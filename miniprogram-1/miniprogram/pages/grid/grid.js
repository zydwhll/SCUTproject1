// pages/grid/grid.js
Page({
  data: {
    title: '压力显示小程序',
    pressure: null,
    pressureText: '--',
    pressureColorClass: 'blue'
  },

  onLoad() {
    const app = getApp();
    this.updateFromGlobal(app);

    this.dataListener = setInterval(() => {
      this.updateFromGlobal(getApp());
    }, 300);
  },

  onUnload() {
    clearInterval(this.dataListener);
  },

  updateFromGlobal(app) {
    const pressure = app && app.globalData && app.globalData.bluetooth
      ? app.globalData.bluetooth.pressure
      : null;
    const nextPressureText = typeof pressure === 'number' ? `${pressure}` : '--';
    const nextColorClass = this.getPressureColorClass(pressure);

    if (
      pressure !== this.data.pressure ||
      nextPressureText !== this.data.pressureText ||
      nextColorClass !== this.data.pressureColorClass
    ) {
      this.setData({
        pressure,
        pressureText: nextPressureText,
        pressureColorClass: nextColorClass
      });
    }
  },

  getPressureColorClass(pressure) {
    if (typeof pressure !== 'number') return 'blue';
    if (pressure < 10) return 'blue';
    if (pressure > 20) return 'red';
    return 'green';
  }
});
