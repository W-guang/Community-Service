const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')

Page({
  data: {
    tab: 'points',
    pointLogs: [],
    creditLogs: [],
    loading: true,
  },
  async onShow() {
    await this.load()
  },
  format(ts) { return formatDateTime(ts) },
  setTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab })
    if (tab === 'points') this.loadPoints()
    else this.loadCredits()
  },
  async load() {
    this.setData({ loading: true })
    await this.loadPoints()
    this.setData({ loading: false })
  },
  async loadPoints() {
    try {
      const res = await callApi('user.pointLogs', { pageSize: 50 })
      this.setData({ pointLogs: res.items || [] })
    } catch (_) {}
  },
  async loadCredits() {
    try {
      const res = await callApi('user.creditLogs', { pageSize: 50 })
      this.setData({ creditLogs: res.items || [] })
    } catch (_) {}
  },
})
