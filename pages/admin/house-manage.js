const { callApi } = require('../../utils/api')

Page({
  data: {
    items: [], total: 0, loading: true,
    community: '', building: '', unit: '',
    room: '',           // 单个房号
    batchRooms: '',     // 批量房号
    batchMode: false,   // 仅控制UI显示
    adding: false,
    batchResult: '',
  },
  async onShow() { await this.load() },

  // 独立的字段handler，不依赖 data-k
  onCommunity(e) { this.setData({ community: e.detail.value }) },
  onBuilding(e)  { this.setData({ building: e.detail.value }) },
  onUnit(e)      { this.setData({ unit: e.detail.value }) },
  onRoom(e)      { this.setData({ room: e.detail.value }) },
  onBatchRooms(e){ this.setData({ batchRooms: e.detail.value }) },

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
    const community = (this.data.community || '').trim()
    const building  = (this.data.building || '').trim()
    const unit      = (this.data.unit || '').trim()
    const room      = (this.data.room || '').trim()
    const batchText = (this.data.batchRooms || '').trim()

    if (!community || !building || !unit) {
      return wx.showToast({ title: '请填写小区、楼栋、单元', icon: 'none' })
    }

    // 自动检测：批量和单个哪个有内容就用哪个
    if (batchText) {
      // 批量模式
      const rooms = batchText.split(/[,\n，\s]+/).filter(Boolean)
      if (!rooms.length) {
        return wx.showToast({ title: '未识别到有效房号，请用逗号分隔', icon: 'none' })
      }
      this.setData({ adding: true, batchResult: '' })
      try {
        const res = await callApi('house.add', { community, building, unit, rooms })
        const added   = res.results.filter(r => r.status === 'added').length
        const existed = res.results.filter(r => r.status === 'existed').length
        this.setData({
          batchResult: `共${res.results.length}条：新增${added}，已存在${existed}`,
          adding: false, batchRooms: '', community: '', building: '', unit: '',
        })
        wx.showToast({ title: `新增${added}条`, icon: 'success' })
        await this.load()
      } catch (e) {
        this.setData({ adding: false })
        wx.showToast({ title: e.message || '添加失败', icon: 'none' })
      }
      return
    }

    if (!room) {
      return wx.showToast({ title: '请输入房号', icon: 'none' })
    }

    // 单个模式
    this.setData({ adding: true })
    try {
      const res = await callApi('house.add', { community, building, unit, room })
      if (res.status === 'existed') {
        wx.showToast({ title: '该房屋已存在', icon: 'none' })
      } else {
        wx.showToast({ title: '添加成功', icon: 'success' })
        this.setData({ room: '', community: '', building: '', unit: '' })
        await this.load()
      }
    } catch (e) {
      wx.showToast({ title: e.message || '添加失败', icon: 'none' })
    } finally { this.setData({ adding: false }) }
  },

  async deleteHouse(e) {
    const id = e.currentTarget.dataset.id
    const label = e.currentTarget.dataset.label
    const result = await new Promise(r => wx.showModal({ title: '确认删除', content: `删除 ${label}？`, success: r }))
    if (!result.confirm) return
    try {
      await callApi('house.delete', { _id: id })
      wx.showToast({ title: '已删除', icon: 'success' })
      await this.load()
    } catch (e) { wx.showToast({ title: e.message || '删除失败', icon: 'none' }) }
  },
})
