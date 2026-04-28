Component({
  data: {
    displayText: '电量：未连接'
  },

  lifetimes: {
    attached() {
      this.updateFromGlobal();
      this._interval = setInterval(() => this.updateFromGlobal(), 300);
    },

    detached() {
      if (this._interval) clearInterval(this._interval);
      this._interval = null;
    }
  },

  methods: {
    updateFromGlobal() {
      const app = getApp();
      const { connected, battery } = app.globalData.bluetooth || {};

      const safeBattery = typeof battery === 'number' ? battery : 0;
      const nextText = connected
        ? `电量：${safeBattery}%`
        : '电量：未连接';

      if (nextText !== this.data.displayText) {
        this.setData({ displayText: nextText });
      }
    }
  }
});
