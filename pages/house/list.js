const { callApi } = require('../../utils/api')

const STATUS_TEXT = {
  bound: '已绑定',
  pending_verify: '待核验',
  rejected: '已驳回',
}

Page({
  data: {
    items: [],
    boundCount: 0,
  },
  async onShow() {
    await this.load()
  },
  statusText(s) {
    return STATUS_TEXT[s] || s
  },
  async load() {
    try {
      const res = await callApi('house.myList', {})
      const app = getApp()
      app.globalData.bindings = res
      const items = res.houses || []
      const boundCount = res.boundCount || 0
      this.setData({ items, boundCount })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  goBind() {
    wx.navigateTo({ url: '/pages/house/bind' })
  },
})

