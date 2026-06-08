const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')
const { ensureBoundOrRedirect } = require('../../utils/guard')

const STATUS_TEXT = { pending_review: '待审核', open: '可接单', taken: '进行中', waiting_confirm: '待确认', done: '已完成', rejected: '已拒绝', expired: '已过期' }

Page({
  data: {
    _id: '', user: null, help: null, progress: [], msg: '', sending: false,
    canOperate: false, canTake: false, canWaitingConfirm: false, canDone: false, canChat: false,
    showRate: false, myRating: 0, myRatingDone: false, rateComment: '', ratingTarget: '',
    // 联系电话
    showPhone: null,
  },
  async onLoad(query) {
    this.setData({ _id: query._id || '' })
    const ok = await ensureBoundOrRedirect()
    if (!ok) return
    await this.ensureAuth()
    await this.load()
  },
  format(ts) { return formatDateTime(ts) },
  statusText(s) { return STATUS_TEXT[s] || s },
  async ensureAuth() {
    const app = getApp()
    if (app.globalData.user) { this.setData({ user: app.globalData.user }); return }
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
    const canChat = (isOwner || isTaker) && (help.status === 'taken' || help.status === 'waiting_confirm')
    // 接单后显示电话
    let showPhone = null
    if (help.status !== 'open' && help.status !== 'pending_review') {
      if (isOwner && help.takerPhone) showPhone = { label: '接单者电话', phone: help.takerPhone, name: help.takerName }
      if (isTaker && help.ownerPhone) showPhone = { label: '发布者电话', phone: help.ownerPhone, name: help.ownerName }
    }
    this.setData({
      canOperate: canTake || canWaitingConfirm || canDone,
      canTake, canWaitingConfirm, canDone, canChat, showPhone,
    })
  },
  async load() {
    try {
      const res = await callApi('help.detail', { _id: this.data._id })
      this.setData({ help: res.help, progress: res.progress || [] })
      this.computePerms(res.help)
      this.computeRatePerms(res.help)
    } catch (e) { wx.showToast({ title: e.message || '加载失败', icon: 'none' }) }
  },
  async take() {
    try {
      wx.showLoading({ title: '接单中' })
      await callApi('help.take', { _id: this.data._id })
      wx.hideLoading()
      await this.load()
    } catch (e) { wx.hideLoading(); wx.showToast({ title: e.message || '接单失败', icon: 'none' }) }
  },
  async setStatus(e) {
    const status = e.currentTarget.dataset.status
    try {
      wx.showLoading({ title: '更新中' })
      await callApi('help.updateStatus', { _id: this.data._id, status })
      wx.hideLoading()
      await this.load()
    } catch (err) { wx.hideLoading(); wx.showToast({ title: err.message || '更新失败', icon: 'none' }) }
  },
  onMsg(e) { this.setData({ msg: e.detail.value }) },
  async send() {
    if (this.data.sending) return
    const content = (this.data.msg || '').trim()
    if (!content) return
    this.setData({ sending: true })
    try {
      await callApi('help.addProgress', { helpId: this.data._id, content })
      this.setData({ msg: '' })
      await this.load()
    } catch (e) { wx.showToast({ title: e.message || '发送失败', icon: 'none' }) }
    finally { this.setData({ sending: false }) }
  },
  computeRatePerms(help) {
    const openid = this.data.user && this.data.user.openid
    const isOwner = help.openid === openid
    const isTaker = help.takerOpenid === openid
    const canRate = help.status === 'done' && (isOwner || isTaker)
    const targetName = isOwner ? (help.takerName || '接单人') : (help.ownerName || '发布者')
    this.setData({ showRate: canRate && !this.data.myRatingDone, ratingTarget: targetName })
    if (canRate) {
      callApi('help.detail', { _id: this.data._id }).then((res) => {
        const hasRated = (res.progress || []).some((p) => p.content && p.content.includes('评价'))
        if (hasRated) this.setData({ myRatingDone: true, showRate: false })
      }).catch(() => {})
    }
  },
  onRateStar(e) { this.setData({ myRating: Number(e.currentTarget.dataset.star) }) },
  onRateComment(e) { this.setData({ rateComment: e.detail.value }) },
  async submitRate() {
    if (this.data.myRating < 1) return wx.showToast({ title: '请选择评分', icon: 'none' })
    try {
      wx.showLoading({ title: '提交评价' })
      await callApi('help.rate', { helpId: this.data._id, score: this.data.myRating, comment: this.data.rateComment })
      wx.hideLoading()
      wx.showToast({ title: '评价成功' })
      this.setData({ myRatingDone: true, showRate: false })
      await this.load()
    } catch (e) { wx.hideLoading(); wx.showToast({ title: e.message || '评价失败', icon: 'none' }) }
  },
  // 拨打电话
  callPhone() {
    if (this.data.showPhone && this.data.showPhone.phone) {
      wx.makePhoneCall({ phoneNumber: this.data.showPhone.phone })
    }
  },
})
