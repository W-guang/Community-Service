const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')

const STATUS_TEXT = {
  pending: '待受理',
  processing: '处理中',
  waiting_confirm: '待确认',
  done: '已完成',
}

Page({
  data: {
    repairTodos: [],
    sosTodos: [],
  },
  async onShow() {
    await this.load()
  },
  format(ts) {
    return formatDateTime(ts)
  },
  statusText(s) {
    return STATUS_TEXT[s] || s
  },
  async load() {
    try {
      const [repairs, sos] = await Promise.all([callApi('repair.list', {}), callApi('sos.list', { status: 'pending' })])
      const repairTodos = (repairs.items || []).filter((r) => r.status !== 'done').slice(0, 20)
      this.setData({ repairTodos, sosTodos: sos.items || [] })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  goRepair(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/repair/detail?_id=${id}` })
  },
  async setSos(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    try {
      await callApi('sos.updateStatus', { _id: id, status })
      await this.load()
    } catch (err) {
      wx.showToast({ title: err.message || '更新失败', icon: 'none' })
    }
  },
})

