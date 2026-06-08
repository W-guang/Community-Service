const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')
const { ensureBoundOrRedirect } = require('../../utils/guard')

const STATUS_TEXT = { pending: '待受理', processing: '处理中', waiting_confirm: '待确认', done: '已完成' }

Page({
  data: {
    items: [], loading: true, adminMode: false,
    filterStatus: '', // 管理模式下的状态筛选
  },
  async onShow() {
    const app = getApp()
    const adminMode = app.isAdminMode ? app.isAdminMode() : false
    this.setData({ adminMode })
    if (!adminMode) { const ok = await ensureBoundOrRedirect(); if (!ok) return }
    await this.load()
  },
  format(ts) { return formatDateTime(ts) },
  statusText(s) { return STATUS_TEXT[s] || s },
  setFilter(e) {
    const s = e.currentTarget.dataset.status
    const newFilter = this.data.filterStatus === s ? '' : s
    this.setData({ filterStatus: newFilter }, () => this.load())
  },
  async load() {
    this.setData({ loading: true })
    try {
      const params = {}
      if (this.data.adminMode && this.data.filterStatus) {
        params.status = this.data.filterStatus
      }
      const res = await callApi('repair.list', params)
      this.setData({ items: res.items || [], loading: false })
    } catch (e) { this.setData({ loading: false }) }
  },
  goCreate() { wx.navigateTo({ url: '/pages/repair/create' }) },
  goDetail(e) { wx.navigateTo({ url: `/pages/repair/detail?_id=${e.currentTarget.dataset.id}` }) },
})
