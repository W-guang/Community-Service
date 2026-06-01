const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')
const { ensureBoundOrRedirect } = require('../../utils/guard')

Page({
  data: { items: [], isStaff: false, loading: true, adminMode: false },
  async onShow() {
    const app = getApp()
    const adminMode = app.isAdminMode ? app.isAdminMode() : false
    this.setData({ adminMode })
    if (!adminMode) { const ok = await ensureBoundOrRedirect(); if (!ok) return }
    await this.ensureAuth()
    await this.load()
  },
  format(ts) { return formatDateTime(ts) },
  async ensureAuth() {
    try {
      const app = getApp()
      const u = app.globalData.user ? app.globalData.user : (await callApi('auth')).user
      app.globalData.user = u
      this.setData({ isStaff: u.role === 'staff' || u.role === 'admin' })
    } catch (e) { this.setData({ isStaff: false }) }
  },
  async load() {
    this.setData({ loading: true })
    try {
      const res = await callApi('notice.list', {})
      this.setData({ items: res.items || [], loading: false })
    } catch (e) { this.setData({ loading: false }) }
  },
  goDetail(e) { wx.navigateTo({ url: `/pages/notices/detail?_id=${e.currentTarget.dataset.id}` }) },
  goManage() { wx.navigateTo({ url: '/pages/admin/notice-manage' }) },
})
