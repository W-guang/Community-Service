const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')
const { ensureBoundOrRedirect } = require('../../utils/guard')

Page({
  data: { tab: 'all', items: [], pendingItems: [], pendingCount: 0, pendingTabLabel: '待办公告', subTitle: '0 条公告', isStaff: false, loading: true, adminMode: false },
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
  setTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab, loading: true }, () => this.load())
  },
  async load() {
    this.setData({ loading: true })
    try {
      const tab = this.data.tab
      if (tab === 'pending' && !this.data.adminMode) {
        const res = await callApi('notice.pending', {})
        const count = res.count || 0
        this.setData({
          pendingItems: res.items || [], pendingCount: count,
          pendingTabLabel: count > 0 ? '待办公告 (' + count + ')' : '待办公告',
          subTitle: count + ' 条待办', loading: false,
        })
      } else if (this.data.adminMode) {
        const res = await callApi('notice.listAll', {})
        const items = res.items || []
        this.setData({ items, subTitle: items.length + ' 条公告', loading: false })
      } else {
        const res = await callApi('notice.list', {})
        const items = res.items || []
        this.setData({ items, subTitle: items.length + ' 条公告', loading: false })
      }
    } catch (e) { this.setData({ loading: false }) }
  },
  goDetail(e) { wx.navigateTo({ url: `/pages/notices/detail?_id=${e.currentTarget.dataset.id}` }) },
  goManage() { wx.navigateTo({ url: '/pages/admin/notice-manage' }) },
})
