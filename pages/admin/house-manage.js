const { callApi } = require('../../utils/api')

Page({
  data: {
    items: [], total: 0, loading: true,
    community: '', building: '', unit: '',
    room: '', batchRooms: '', batchMode: false,
    adding: false, batchResult: '',
  },
  async onShow() { await this.load() },

  onCommunity(e)    { this.setData({ community: e.detail.value }) },
  onBuilding(e)     { this.setData({ building: e.detail.value }) },
  onUnit(e)         { this.setData({ unit: e.detail.value }) },
  onRoom(e)         { this.setData({ room: e.detail.value }) },
  onBatchRooms(e)   { this.setData({ batchRooms: e.detail.value }) },

  toggleBatch() {
    this.setData({ batchMode: !this.data.batchMode, batchResult: '' })
  },

  async load() {
    this.setData({ loading: true })
    try {
      const res = await callApi('house.listAll', { pageSize: 100 })
      this.setData({ items: res.items || [], total: res.total, loading: false })
    } catch (e) { this.setData({ loading: false }) }
  },

  async add() {
    const c = (this.data.community || '').trim()
    const b = (this.data.building || '').trim()
    const u = (this.data.unit || '').trim()
    if (!c || !b || !u) {
      return wx.showToast({ title: '请填写小区、楼栋、单元', icon: 'none' })
    }

    // 批量模式：有 batchRooms 内容时优先批量
    if (this.data.batchMode) {
      const raw = (this.data.batchRooms || '').trim()
      if (!raw) return wx.showToast({ title: '请输入房号列表', icon: 'none' })
      const rooms = raw.split(/[,\n，]+/).map(s => s.trim()).filter(Boolean)
      if (!rooms.length) return wx.showToast({ title: '未识别到有效房号', icon: 'none' })

      this.setData({ adding: true, batchResult: '' })
      try {
        const res = await callApi('house.add', { community: c, building: b, unit: u, rooms })
        const added = res.results.filter(r => r.status === 'added').length
        const existed = res.results.filter(r => r.status === 'existed').length
        this.setData({ adding: false, batchRooms: '', batchResult: `共${res.results.length}条：新增${added}，已存在${existed}` })
        wx.showToast({ title: `新增${added}条`, icon: 'success' })
        this.load()
      } catch (e) {
        this.setData({ adding: false })
        wx.showToast({ title: e.message || '添加失败', icon: 'none' })
      }
      return
    }

    // 单个模式
    const r = (this.data.room || '').trim()
    if (!r) return wx.showToast({ title: '请输入房号', icon: 'none' })

    this.setData({ adding: true })
    try {
      const res = await callApi('house.add', { community: c, building: b, unit: u, room: r })
      if (res.status === 'existed') {
        wx.showToast({ title: '该房屋已存在', icon: 'none' })
      } else {
        wx.showToast({ title: '添加成功', icon: 'success' })
        this.setData({ room: '' })
        this.load()
      }
    } catch (e) {
      wx.showToast({ title: e.message || '添加失败', icon: 'none' })
    } finally { this.setData({ adding: false }) }
  },

  async deleteHouse(e) {
    const { id, label } = e.currentTarget.dataset
    const result = await new Promise(r => wx.showModal({ title: '确认删除', content: `删除 ${label}？`, success: r }))
    if (!result.confirm) return
    try {
      await callApi('house.delete', { _id: id })
      wx.showToast({ title: '已删除', icon: 'success' })
      this.load()
    } catch (e) { wx.showToast({ title: e.message || '删除失败', icon: 'none' }) }
  },
})
