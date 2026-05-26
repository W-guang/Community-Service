const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')
const { ensureBoundOrRedirect } = require('../../utils/guard')

const STATUS_TEXT = {
  pending: '待受理',
  processing: '处理中',
  waiting_confirm: '待确认',
  done: '已完成',
}

Page({
  data: {
    items: [],
    loading: true,
  },
  async onShow() {
    const ok = await ensureBoundOrRedirect()
    if (!ok) return
    await this.load()
  },
  format(ts) {
    return formatDateTime(ts)
  },
  statusText(s) {
    return STATUS_TEXT[s] || s
  },
  async load() {
    this.setData({ loading: true })
    try {
      const res = await callApi('repair.list', {})
      this.setData({ items: res.items || [], loading: false })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  goCreate() {
    wx.navigateTo({ url: '/pages/repair/create' })
  },
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/repair/detail?_id=${id}` })
  },
})
