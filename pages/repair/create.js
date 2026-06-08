const { callApi } = require('../../utils/api')
const { ensureBoundOrRedirect } = require('../../utils/guard')
const { rules, validateForm } = require('../../utils/validate')

Page({
  async onShow() {
    const ok = await ensureBoundOrRedirect()
    if (!ok) wx.navigateBack({ delta: 1 })
    await this.loadHouses()
  },
  data: {
    categories: ['水电', '公共设施', '门禁', '卫生', '其他'],
    categoryIndex: 0,
    title: '',
    content: '',
    images: [],
    houses: [],
    houseDisplayList: [],
    selectedHouseIndex: -1,
    submitting: false,
  },
  async loadHouses() {
    try {
      const res = await callApi('house.myList', {})
      const boundHouses = (res.houses || []).filter(h => h.status === 'bound')
      const houseDisplayList = boundHouses.map(h =>
        h.community + ' ' + h.building + '号楼 ' + h.unit + '单元 ' + h.room + '室'
      )
      this.setData({ houses: boundHouses, houseDisplayList, selectedHouseIndex: boundHouses.length > 0 ? 0 : -1 })
    } catch (e) {}
  },
  onPickCategory(e) {
    this.setData({ categoryIndex: Number(e.detail.value || 0) })
  },
  onPickHouse(e) {
    this.setData({ selectedHouseIndex: Number(e.detail.value || 0) })
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
    const content = (this.data.content || '').trim()

    const { valid, first } = validateForm(
      { title, content },
      {
        title: [rules.required, rules.maxLength(50)],
        content: [rules.required, rules.maxLength(500)],
      },
    )
    if (!valid) {
      wx.showToast({ title: first, icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      wx.showLoading({ title: '提交中' })
      const images = this.data.images.length ? await this.uploadImages(this.data.images) : []
      const selectedHouse = this.data.houses[this.data.selectedHouseIndex] || null
      const res = await callApi('repair.create', {
        category,
        title,
        content,
        images,
        houseId: selectedHouse ? selectedHouse._id : '',
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
