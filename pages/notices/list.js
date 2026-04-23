const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')
const { ensureBoundOrRedirect } = require('../../utils/guard')

Page({
  data: {
    items: [],
    isStaff: false,
  },
  async onShow() {
    const ok = await ensureBoundOrRedirect()
    if (!ok) return
    await this.ensureAuth()
    await this.load()
  },
  format(ts) {
    return formatDateTime(ts)
  },
  async ensureAuth() {
    try {
      const app = getApp()
      const u = app.globalData.user ? app.globalData.user : (await callApi('auth')).user
      app.globalData.user = u
      this.setData({ isStaff: u.role === 'staff' || u.role === 'admin' })
    } catch (e) {
      this.setData({ isStaff: false })
    }
  },
  async load() {
    try {
      const res = await callApi('notice.list', {})
      this.setData({ items: res.items || [] })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/notices/detail?_id=${id}` })
  },
  goManage() {
    wx.navigateTo({ url: '/pages/admin/notice-manage' })
  },
})

