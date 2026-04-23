const { callApi } = require('../../utils/api')
const { ensureBoundOrRedirect } = require('../../utils/guard')

Page({
  async onShow() {
    const ok = await ensureBoundOrRedirect()
    if (!ok) wx.navigateBack({ delta: 1 })
  },
  data: {
    categories: ['水电', '公共设施', '门禁', '卫生', '其他'],
    categoryIndex: 0,
    title: '',
    content: '',
    images: [],
    location: null,
    locationText: '未选择（可选）',
    submitting: false,
  },
  onPickCategory(e) {
    this.setData({ categoryIndex: Number(e.detail.value || 0) })
  },
  onTitle(e) {
    this.setData({ title: e.detail.value })
  },
  onContent(e) {
    this.setData({ content: e.detail.value })
  },
  addImage() {
    wx.chooseMedia({
      count: 6 - this.data.images.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = (res.tempFiles || []).map((f) => f.tempFilePath).filter(Boolean)
        this.setData({ images: [...this.data.images, ...paths].slice(0, 6) })
      },
    })
  },
  removeImage(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const next = this.data.images.filter((_, i) => i !== idx)
    this.setData({ images: next })
  },
  pickLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (r) => {
        const loc = { latitude: r.latitude, longitude: r.longitude }
        this.setData({ location: loc, locationText: `已获取定位：${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}` })
      },
      fail: () => {
        wx.showToast({ title: '定位失败（可跳过）', icon: 'none' })
      },
    })
  },
  async uploadImages(paths) {
    const fileIDs = []
    for (const p of paths) {
      const ext = (p.split('.').pop() || 'jpg').toLowerCase()
      const cloudPath = `repairs/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`
      const res = await wx.cloud.uploadFile({ cloudPath, filePath: p })
      fileIDs.push(res.fileID)
    }
    return fileIDs
  },
  async submit() {
    if (this.data.submitting) return
    const category = this.data.categories[this.data.categoryIndex] || '其他'
    const title = (this.data.title || '').trim()
    if (!title) {
      wx.showToast({ title: '请填写标题', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      wx.showLoading({ title: '提交中' })
      const images = this.data.images.length ? await this.uploadImages(this.data.images) : []
      const res = await callApi('repair.create', {
        category,
        title,
        content: (this.data.content || '').trim(),
        images,
        location: this.data.location,
      })
      wx.hideLoading()
      wx.showToast({ title: '提交成功' })
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/repair/detail?_id=${res._id}` })
      }, 300)
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
})

