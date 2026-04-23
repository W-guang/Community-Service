const { callApi } = require('../../utils/api')
const { ensureBoundOrRedirect } = require('../../utils/guard')

Page({
  async onShow() {
    const ok = await ensureBoundOrRedirect()
    if (!ok) wx.navigateBack({ delta: 1 })
  },
  data: {
    types: ['代取件', '陪诊', '搬运', '跑腿', '其他'],
    typeIndex: 0,
    title: '',
    content: '',
    rewardPoints: '0',
    submitting: false,
  },
  onPickType(e) {
    this.setData({ typeIndex: Number(e.detail.value || 0) })
  },
  onTitle(e) {
    this.setData({ title: e.detail.value })
  },
  onContent(e) {
    this.setData({ content: e.detail.value })
  },
  onReward(e) {
    this.setData({ rewardPoints: e.detail.value })
  },
  async submit() {
    if (this.data.submitting) return
    const title = (this.data.title || '').trim()
    const content = (this.data.content || '').trim()
    if (!title) {
      wx.showToast({ title: '请填写标题', icon: 'none' })
      return
    }
    if (!content) {
      wx.showToast({ title: '请填写描述', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      wx.showLoading({ title: '发布中' })
      const res = await callApi('help.create', {
        type: this.data.types[this.data.typeIndex] || '其他',
        title,
        content,
        rewardPoints: Number(this.data.rewardPoints || 0),
      })
      wx.hideLoading()
      wx.showToast({ title: '发布成功' })
      setTimeout(() => wx.redirectTo({ url: `/pages/help/detail?_id=${res._id}` }), 300)
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '发布失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
})

