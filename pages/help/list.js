const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')
const { ensureBoundOrRedirect } = require('../../utils/guard')

const STATUS_TEXT = {
  open: '可接单',
  taken: '进行中',
  waiting_confirm: '待确认',
  done: '已完成',
}

Page({
  data: {
    tab: 'hall',
    items: [],
  },
  async onShow() {
    const ok = await ensureBoundOrRedirect()
    if (!ok) return
    await this.load()
  },
  setTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab, items: [] })
    this.load()
  },
  format(ts) {
    return formatDateTime(ts)
  },
  statusText(s) {
    return STATUS_TEXT[s] || s
  },
  async load() {
    try {
      const mine = this.data.tab === 'mine'
      const takenByMe = this.data.tab === 'taken'
      const res = await callApi('help.list', { mine, takenByMe })
      this.setData({ items: res.items || [] })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  goCreate() {
    wx.navigateTo({ url: '/pages/help/create' })
  },
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/help/detail?_id=${id}` })
  },
})

