const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')

Page({
  data: {
    loading: false,
    stats: null,
  },
  async onShow() {
    await this.load()
  },
  format(ts) {
    return formatDateTime(ts)
  },
  async load() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const res = await callApi('dashboard.stats', {})
      this.setData({ stats: res })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})

