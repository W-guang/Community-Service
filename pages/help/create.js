const { callApi } = require('../../utils/api')
const { ensureBoundOrRedirect } = require('../../utils/guard')
const { rules, validateForm } = require('../../utils/validate')

const DEADLINE_OPTIONS = [1, 3, 5, 7, 10, 14, 21, 30]

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
    deadlineOptions: DEADLINE_OPTIONS,
    deadlineIndex: 3, // 默认7天
    submitting: false,
  },
  onPickType(e) { this.setData({ typeIndex: Number(e.detail.value || 0) }) },
  onTitle(e) { this.setData({ title: e.detail.value }) },
  onContent(e) { this.setData({ content: e.detail.value }) },
  onReward(e) { this.setData({ rewardPoints: e.detail.value }) },
  onDeadline(e) { this.setData({ deadlineIndex: Number(e.detail.value || 3) }) },
  async submit() {
    if (this.data.submitting) return
    const title = (this.data.title || '').trim()
    const content = (this.data.content || '').trim()
    const rewardPoints = Number(this.data.rewardPoints || 0)
    const { valid, first } = validateForm(
      { title, content, rewardPoints },
      { title: [rules.required, rules.maxLength(50)], content: [rules.required, rules.maxLength(500)], rewardPoints: [rules.range(0, 999)] },
    )
    if (!valid) { wx.showToast({ title: first, icon: 'none' }); return }
    this.setData({ submitting: true })
    try {
      wx.showLoading({ title: '提交审核' })
      const res = await callApi('help.create', {
        type: this.data.types[this.data.typeIndex] || '其他', title, content, rewardPoints,
        deadlineDays: DEADLINE_OPTIONS[this.data.deadlineIndex] || 7,
      })
      wx.hideLoading()
      wx.showToast({ title: '已提交审核，等待管理员确认' })
      setTimeout(() => wx.redirectTo({ url: `/pages/help/detail?_id=${res._id}` }), 500)
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '发布失败', icon: 'none' })
    } finally { this.setData({ submitting: false }) }
  },
})
