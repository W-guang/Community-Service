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
    _id: '',
    user: null,
    isStaff: false,
    repair: null,
    comments: [],
    comment: '',
    sending: false,
  },
  async onLoad(query) {
    this.setData({ _id: query._id || '' })
    const ok = await ensureBoundOrRedirect()
    if (!ok) return
    await this.ensureAuth()
    await this.load()
  },
  format(ts) {
    return formatDateTime(ts)
  },
  statusText(s) {
    return STATUS_TEXT[s] || s
  },
  async ensureAuth() {
    const app = getApp()
    if (app.globalData.user) {
      const u = app.globalData.user
      this.setData({ user: u, isStaff: u.role === 'staff' || u.role === 'admin' })
      return
    }
    const res = await callApi('auth')
    app.globalData.user = res.user
    this.setData({ user: res.user, isStaff: res.user.role === 'staff' || res.user.role === 'admin' })
  },
  async load() {
    try {
      const res = await callApi('repair.detail', { _id: this.data._id })
      this.setData({ repair: res.repair, comments: res.comments || [] })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  preview(e) {
    const src = e.currentTarget.dataset.src
    wx.previewImage({ current: src, urls: this.data.repair.images || [] })
  },
  async setStatus(e) {
    const status = e.currentTarget.dataset.status
    try {
      wx.showLoading({ title: '更新中' })
      await callApi('repair.updateStatus', { _id: this.data._id, status })
      wx.hideLoading()
      await this.load()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '更新失败', icon: 'none' })
    }
  },
  onComment(e) {
    this.setData({ comment: e.detail.value })
  },
  async send() {
    if (this.data.sending) return
    const content = (this.data.comment || '').trim()
    if (!content) return
    this.setData({ sending: true })
    try {
      await callApi('repair.comment', { repairId: this.data._id, content })
      this.setData({ comment: '' })
      await this.load()
    } catch (e) {
      wx.showToast({ title: e.message || '发送失败', icon: 'none' })
    } finally {
      this.setData({ sending: false })
    }
  },
})

