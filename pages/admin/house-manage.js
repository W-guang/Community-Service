const { callApi } = require('../../utils/api')

Page({
  data: {
    items: [], total: 0, loading: true,
    // 添加表单
    form: { community: '', building: '', unit: '', room: '' },
    adding: false,
    // 批量添加
    batchMode: false,
    batchRooms: '',
    batchResult: null,
  },
  async onShow() {
    await this.load()
  },
  onInput(e) {
    const k = e.currentTarget.dataset.k
    this.setData({ ['form.' + k]: e.detail.value })
  },
  onBatchInput(e) {
    this.setData({ batchRooms: e.detail.value })
  },
  async load() {
    this.setData({ loading: true })
    try {
      const res = await callApi('house.listAll', { pageSize: 100 })
      this.setData({ items: res.items || [], total: res.total, loading: false })
    } catch (e) {
      this.setData({ loading: false })
    }
  },
  async add() {
    const f = this.data.form
    const community = (f.community || '').trim()
    const building = (f.building || '').trim()
    const unit = (f.unit || '').trim()
    const room = (f.room || '').trim()

    // 批量模式
    if (this.data.batchMode) {
      if (!community || !building || !unit) return wx.showToast({ title: '请填写小区/楼栋/单元', icon: 'none' })
      const rooms = (this.data.batchRooms || '').split(/[,\n，\s]+/).map(s => s.trim()).filter(Boolean)
      if (!rooms.length) return wx.showToast({ title: '请输入房号（逗号或换行分隔）', icon: 'none' })
      this.setData({ adding: true })
      try {
        const res = await callApi('house.add', { community, building, unit, rooms })
        const added = res.results.filter(r => r.status === 'added').length
        const existed = res.results.filter(r => r.status === 'existed').length
        this.setData({
          batchResult: `共 ${res.results.length} 条：新增 ${added} 条，已存在 ${existed} 条`,
          adding: false, batchRooms: '', form: { community, building, unit, room: '' },
        })
        wx.showToast({ title: `新增${added}条，跳过${existed}条`, icon: 'success' })
        await this.load()
      } catch (e) {
        this.setData({ adding: false })
        wx.showToast({ title: e.message || '添加失败', icon: 'none' })
      }
      return
    }

    // 单个添加
    if (!community || !building || !unit || !room) return wx.showToast({ title: '请完整填写房屋地址', icon: 'none' })
    this.setData({ adding: true })
    try {
      const res = await callApi('house.add', { community, building, unit, room })
      if (res.status === 'existed') {
        wx.showToast({ title: '该房屋已存在', icon: 'none' })
      } else {
        wx.showToast({ title: '添加成功', icon: 'success' })
        this.setData({ 'form.room': '' })
        await this.load()
      }
    } catch (e) {
      wx.showToast({ title: e.message || '添加失败', icon: 'none' })
    } finally {
      this.setData({ adding: false })
    }
  },
  toggleBatch() {
    this.setData({ batchMode: !this.data.batchMode, batchResult: null })
  },
  async deleteHouse(e) {
    const id = e.currentTarget.dataset.id
    const label = e.currentTarget.dataset.label
    try {
      const res = await new Promise(resolve => {
        wx.showModal({ title: '确认删除', content: '删除房屋：' + label + '？', success: resolve })
      })
      if (!res.confirm) return
      await callApi('house.delete', { _id: id })
      wx.showToast({ title: '已删除', icon: 'success' })
      await this.load()
    } catch (e) {
      wx.showToast({ title: e.message || '删除失败', icon: 'none' })
    }
  },
})
