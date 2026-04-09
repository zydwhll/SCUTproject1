Component({
  data: {
    showTip: false,
  },
  properties: {
    showTipProps: Boolean,
    title: String,
    content: String
  },
  observers: {
    showTipProps: function(showTipProps) {
      this.setData({
        showTip: showTipProps
      });
    }
  },
  methods: {
    onClose() {
      this.setData({
        showTip: false
      });
      this.triggerEvent('close'); // 触发关闭事件供父组件监听
    },
    onCancel() {
      this.onClose(); // 复用关闭逻辑
      this.triggerEvent('cancel'); // 触发取消事件
    },
    onConfirm() {
      this.triggerEvent('confirm'); // 触发确认事件
      this.onClose();
    },
  }
});