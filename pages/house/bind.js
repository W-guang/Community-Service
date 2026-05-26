const { callApi } = require('../../utils/api')
const { rules, validateForm } = require('../../utils/validate')

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
    const f = this.data.form
    const data = {
      community: (f.community || '').trim(),
      building: (f.building || '').trim(),
      unit: (f.unit || '').trim(),
      room: (f.room || '').trim(),
      name: (f.name || '').trim(),
      phone: (f.phone || '').trim(),
    }

    const { valid, first } = validateForm(data, {
      community: [rules.required],
      building: [rules.required],
      unit: [rules.required],
      room: [rules.required],
      name: [rules.required],
      phone: [rules.phone],
    })
    if (!valid) {
      wx.showToast({ title: first, icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      wx.showLoading({ title: '提交中' })
      const res = await callApi('house.bind', data)
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
