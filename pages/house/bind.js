const { callApi } = require('../../utils/api')

const STATUS_TEXT = {
  bound: '已绑定',
  pending_verify: '待核验',
  rejected: '已驳回',
}

Page({
  data: {
    form: { community: '', building: '', unit: '', room: '', name: '', phone: '' },
    submitting: false,
    bindings: null,
  },
  async onShow() {
    await this.refresh()
  },
  statusText(s) {
    return STATUS_TEXT[s] || s
  },
  onInput(e) {
    const k = e.currentTarget.dataset.k
    const v = e.detail.value
    this.setData({ [`form.${k}`]: v })
  },
  async refresh() {
    try {
      const res = await callApi('house.myList', {})
      const app = getApp()
      app.globalData.bindings = res
      this.setData({ bindings: res })
    } catch (e) {}
  },
  async submit() {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    try {
      wx.showLoading({ title: '提交中' })
      const res = await callApi('house.bind', { ...this.data.form })
      wx.hideLoading()
      const app = getApp()
      if (res.bindings) app.globalData.bindings = res.bindings
      if (res.status === 'bound') {
        wx.showModal({ title: '绑定成功', content: '现在可以使用报修、公告、互助等功能。', showCancel: false })
      } else {
        wx.showModal({ title: '已提交核验', content: res.message || '请等待管理员核验通过后使用核心功能。', showCancel: false })
      }
      await this.refresh()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
  goMyHouses() {
    wx.navigateTo({ url: '/pages/house/list' })
  },
})

