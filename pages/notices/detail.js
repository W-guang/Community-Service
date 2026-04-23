const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')
const { ensureBoundOrRedirect } = require('../../utils/guard')

Page({
  data: {
    _id: '',
    notice: null,
    read: false,
    isStaff: false,
    stats: { totalUsers: 0, readUsers: 0 },
  },
  async onLoad(query) {
    this.setData({ _id: query._id || '' })
    const ok = await ensureBoundOrRedirect()
    if (!ok) return
    await this.ensureAuth()
    await this.load()
    await this.markRead()
    if (this.data.isStaff) await this.loadStats()
  },
  format(ts) {
    return formatDateTime(ts)
  },
  async ensureAuth() {
    const app = getApp()
    const u = app.globalData.user ? app.globalData.user : (await callApi('auth')).user
    app.globalData.user = u
    this.setData({ isStaff: u.role === 'staff' || u.role === 'admin' })
  },
  async load() {
    try {
      const res = await callApi('notice.detail', { _id: this.data._id })
      this.setData({ notice: res.notice, read: !!res.read })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  async markRead() {
    try {
      await callApi('notice.markRead', { _id: this.data._id })
      this.setData({ read: true })
    } catch (e) {}
  },
  async loadStats() {
    try {
      const res = await callApi('notice.stats', { _id: this.data._id })
      this.setData({ stats: { totalUsers: res.totalUsers || 0, readUsers: res.readUsers || 0 } })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
})

