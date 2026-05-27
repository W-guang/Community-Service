const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')

Page({
  data: {
    loading: false,
    exporting: false,
    stats: null,
    exportResult: '',
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
  async exportData(e) {
    const type = e.currentTarget.dataset.type || 'all'
    this.setData({ exporting: true })
    try {
      wx.showLoading({ title: '导出中...' })
      const res = await callApi('dashboard.export', { type })
      wx.hideLoading()
      const summary = res.summary
      const text = `导出类型: ${type}\n` +
        `报修: ${summary.repairs} | 互助: ${summary.helps} | 公告: ${summary.notices}\n` +
        `SOS: ${summary.sos} | 用户: ${summary.users}\n` +
        `导出时间: ${new Date(res.exportedAt).toLocaleString()}\n` +
        (res.repairs ? `\n报修数据(${res.repairs.length}条):\n${JSON.stringify(res.repairs.slice(0, 5), null, 2)}\n...` : '')
      this.setData({ exportResult: text })
      wx.showToast({ title: '导出成功', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '导出失败', icon: 'none' })
    } finally {
      this.setData({ exporting: false })
    }
  },
})
