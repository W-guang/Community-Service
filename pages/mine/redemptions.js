const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')

Page({
  data: {
    items: [],
    loading: true,
  },

  onShow() {
    this.load()
  },

  async load() {
    this.setData({ loading: true })
    try {
      const res = await callApi('gift.myRedeems', { pageSize: 50 })
      const statusMap = { pending: '待发放', fulfilled: '已发放' }
      const items = (res.items || []).map(it => ({
        ...it,
        timeText: formatDateTime(it.createdAt),
        statusText: statusMap[it.status] || it.status,
      }))
      this.setData({ items, loading: false })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
})
