const { callApi } = require('../../utils/api')

Page({
  data: {
    items: [],
  },
  async onShow() {
    await this.load()
  },
  async load() {
    try {
      const res = await callApi('house.pendingList', {})
      this.setData({ items: res.items || [] })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  async approve(e) {
    const id = e.currentTarget.dataset.id
    try {
      await callApi('house.approve', { _id: id })
      wx.showToast({ title: '已通过' })
      await this.load()
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  },
  async reject(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '驳回原因',
      editable: true,
      placeholderText: '可选填写',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await callApi('house.reject', { _id: id, reason: r.content || '' })
          wx.showToast({ title: '已驳回' })
          await this.load()
        } catch (err) {
          wx.showToast({ title: err.message || '操作失败', icon: 'none' })
        }
      },
    })
  },
})

