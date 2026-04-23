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
    _id: '',
    user: null,
    help: null,
    progress: [],
    msg: '',
    sending: false,
    canOperate: false,
    canTake: false,
    canWaitingConfirm: false,
    canDone: false,
    canChat: false,
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
      this.setData({ user: app.globalData.user })
      return
    }
    const res = await callApi('auth')
    app.globalData.user = res.user
    this.setData({ user: res.user })
  },
  computePerms(help) {
    const openid = this.data.user && this.data.user.openid
    const isOwner = help.openid === openid
    const isTaker = help.takerOpenid === openid
    const canTake = help.status === 'open' && !isOwner
    const canWaitingConfirm = isTaker && help.status === 'taken'
    const canDone = isOwner && help.status === 'waiting_confirm'
    const canChat = isOwner || isTaker
    this.setData({
      canOperate: canTake || canWaitingConfirm || canDone,
      canTake,
      canWaitingConfirm,
      canDone,
      canChat,
    })
  },
  async load() {
    try {
      const res = await callApi('help.detail', { _id: this.data._id })
      this.setData({ help: res.help, progress: res.progress || [] })
      this.computePerms(res.help)
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  async take() {
    try {
      wx.showLoading({ title: '接单中' })
      await callApi('help.take', { _id: this.data._id })
      wx.hideLoading()
      await this.load()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '接单失败', icon: 'none' })
    }
  },
  async setStatus(e) {
    const status = e.currentTarget.dataset.status
    try {
      wx.showLoading({ title: '更新中' })
      await callApi('help.updateStatus', { _id: this.data._id, status })
      wx.hideLoading()
      await this.load()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '更新失败', icon: 'none' })
    }
  },
  onMsg(e) {
    this.setData({ msg: e.detail.value })
  },
  async send() {
    if (this.data.sending) return
    const content = (this.data.msg || '').trim()
    if (!content) return
    this.setData({ sending: true })
    try {
      await callApi('help.addProgress', { helpId: this.data._id, content })
      this.setData({ msg: '' })
      await this.load()
    } catch (e) {
      wx.showToast({ title: e.message || '发送失败', icon: 'none' })
    } finally {
      this.setData({ sending: false })
    }
  },
})

