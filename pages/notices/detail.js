const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')
const { ensureBoundOrRedirect } = require('../../utils/guard')

Page({
  data: {
    _id: '', notice: null, read: false, isStaff: false,
    stats: { totalUsers: 0, readUsers: 0, readPercent: 0, isImportant: false },
    // 编辑模式
    editMode: false, editForm: { title: '', content: '', type: '', pinned: false, important: false },
    editing: false,
  },
  async onLoad(query) {
    this.setData({ _id: query._id || '' })
    const ok = await ensureBoundOrRedirect()
    if (!ok) return
    await this.ensureAuth()
    await this.load()
    await this.markRead()
    if (this.data.isStaff) await this.loadStats()
  },
  format(ts) { return formatDateTime(ts) },
  async ensureAuth() {
    const app = getApp()
    const u = app.globalData.user ? app.globalData.user : (await callApi('auth')).user
    app.globalData.user = u
    this.setData({ isStaff: u.role === 'staff' || u.role === 'admin' })
  },
  async load() {
    try {
      const res = await callApi('notice.detail', { _id: this.data._id })
      const notice = res.notice
      this.setData({ notice, read: !!res.read,
        editForm: { title: notice.title, content: notice.content, type: notice.type, pinned: !!notice.pinned, important: !!notice.important },
      })
    } catch (e) { wx.showToast({ title: e.message || '加载失败', icon: 'none' }) }
  },
  async markRead() {
    try {
      await callApi('notice.markRead', { _id: this.data._id })
      this.setData({ read: true })
    } catch (e) {}
  },
  async loadStats() {
    try {
      const res = await callApi('notice.stats', { _id: this.data._id })
      const total = res.totalUsers || 0; const read = res.readUsers || 0
      this.setData({ stats: { totalUsers: total, readUsers: read, readPercent: total > 0 ? Math.round(read/total*100) : 0, isImportant: !!res.isImportant } })
    } catch (e) { wx.showToast({ title: e.message || '加载失败', icon: 'none' }) }
  },
  // --- 编辑模式 ---
  toggleEdit() { this.setData({ editMode: !this.data.editMode }) },
  onEditTitle(e) { this.setData({ 'editForm.title': e.detail.value }) },
  onEditContent(e) { this.setData({ 'editForm.content': e.detail.value }) },
  onEditPinned(e) { this.setData({ 'editForm.pinned': !!e.detail.value }) },
  onEditImportant(e) { this.setData({ 'editForm.important': !!e.detail.value }) },
  async doUpdate() {
    if (this.data.editing) return
    const f = this.data.editForm
    if (!f.title.trim()) return wx.showToast({ title: '标题不能为空', icon: 'none' })
    this.setData({ editing: true })
    try {
      wx.showLoading({ title: '保存中' })
      await callApi('notice.update', { _id: this.data._id, ...f, pinned: f.pinned, important: f.important })
      wx.hideLoading()
      wx.showToast({ title: '已更新' })
      this.setData({ editMode: false, editing: false })
      await this.load()
    } catch (e) { wx.hideLoading(); this.setData({ editing: false }); wx.showToast({ title: e.message || '更新失败', icon: 'none' }) }
  },
  async doDelete() {
    const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '删除后不可恢复', success: r }))
    if (!res.confirm) return
    try {
      await callApi('notice.delete', { _id: this.data._id })
      wx.showToast({ title: '已删除' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 500)
    } catch (e) { wx.showToast({ title: e.message || '删除失败', icon: 'none' }) }
  },
})
