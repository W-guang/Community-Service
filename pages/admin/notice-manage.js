const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')

Page({
  data: {
    types: ['通知', '活动', '温馨提示', '政策'],
    typeIndex: 0,
    form: {
      title: '',
      content: '',
      pinned: false,
      important: false,
    },
    items: [],
    publishing: false,
  },
  async onShow() {
    await this.load()
  },
  format(ts) {
    return formatDateTime(ts)
  },
  onPickType(e) {
    this.setData({ typeIndex: Number(e.detail.value || 0) })
  },
  onTitle(e) {
    this.setData({ 'form.title': e.detail.value })
  },
  onContent(e) {
    this.setData({ 'form.content': e.detail.value })
  },
  onPinned(e) {
    this.setData({ 'form.pinned': !!e.detail.value })
  },
  onImportant(e) {
    this.setData({ 'form.important': !!e.detail.value })
  },
  async publish() {
    if (this.data.publishing) return
    const title = (this.data.form.title || '').trim()
    const content = (this.data.form.content || '').trim()
    if (!title) return wx.showToast({ title: '请填写标题', icon: 'none' })
    if (!content) return wx.showToast({ title: '请填写内容', icon: 'none' })
    this.setData({ publishing: true })
    try {
      wx.showLoading({ title: '发布中' })
      await callApi('notice.create', {
        type: this.data.types[this.data.typeIndex] || '通知',
        title,
        content,
        pinned: this.data.form.pinned,
        important: this.data.form.important,
      })
      wx.hideLoading()
      wx.showToast({ title: '发布成功' })
      this.setData({ form: { title: '', content: '', pinned: false, important: false }, typeIndex: 0 })
      await this.load()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '发布失败', icon: 'none' })
    } finally {
      this.setData({ publishing: false })
    }
  },
  async load() {
    try {
      const res = await callApi('notice.list', {})
      this.setData({ items: res.items || [] })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/notices/detail?_id=${id}` })
  },
})

