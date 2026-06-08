const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')

const STATUS_TEXT = {
  pending: '待受理', processing: '处理中', waiting_confirm: '待确认', done: '已完成',
}

Page({
  data: { repairTodos: [], sosTodos: [], helpReviewTodos: [], tab: 'repair' },
  async onShow() { await this.load() },
  format(ts) { return formatDateTime(ts) },
  statusText(s) { return STATUS_TEXT[s] || s },
  setTab(e) { const tab = e.currentTarget.dataset.tab; this.setData({ tab }, () => this.load()) },
  async load() {
    try {
      if (this.data.tab === 'sos') {
        const sos = await callApi('sos.list', { status: 'pending' })
        this.setData({ sosTodos: sos.items || [] })
      } else if (this.data.tab === 'help') {
        const helps = await callApi('help.list', { status: 'pending_review' })
        this.setData({ helpReviewTodos: (helps.items || []).filter(h => h.status === 'pending_review') })
      } else {
        const repairs = await callApi('repair.list', {})
        this.setData({ repairTodos: (repairs.items || []).filter(r => r.status !== 'done').slice(0, 20) })
      }
    } catch (e) { wx.showToast({ title: e.message || '加载失败', icon: 'none' }) }
  },
  goRepair(e) { wx.navigateTo({ url: `/pages/repair/detail?_id=${e.currentTarget.dataset.id}` }) },
  goHelp(e) { wx.navigateTo({ url: `/pages/help/detail?_id=${e.currentTarget.dataset.id}` }) },
  async setSos(e) {
    const id = e.currentTarget.dataset.id; const status = e.currentTarget.dataset.status
    try { await callApi('sos.updateStatus', { _id: id, status }); await this.load() }
    catch (err) { wx.showToast({ title: err.message || '更新失败', icon: 'none' }) }
  },
  async reviewHelp(e) {
    const id = e.currentTarget.dataset.id; const approve = e.currentTarget.dataset.approve
    try {
      if (approve) {
        wx.showModal({ title: '确认发布', placeholderText: '积分数', editable: true, content: '',
          success: async (r) => {
            if (!r.confirm) return
            const pts = Math.max(0, Math.min(999, parseInt(r.content) || 0))
            await callApi('help.review', { _id: id, approve: true, rewardPoints: pts })
            wx.showToast({ title: '已发布' }); this.load()
          } })
      } else { await callApi('help.review', { _id: id, approve: false }); wx.showToast({ title: '已拒绝' }); this.load() }
    } catch (err) { wx.showToast({ title: err.message || '操作失败', icon: 'none' }) }
  },
})
