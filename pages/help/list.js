const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')
const { ensureBoundOrRedirect } = require('../../utils/guard')

const STATUS_TEXT = { pending_review: '待审核', open: '可接单', taken: '进行中', waiting_confirm: '待确认', done: '已完成', rejected: '已拒绝', expired: '已过期' }

Page({
  data: { tab: 'hall', items: [], loading: true, adminMode: false, leaderboard: [] },
  async onShow() {
    const app = getApp()
    const adminMode = app.isAdminMode ? app.isAdminMode() : false
    this.setData({ adminMode })
    if (!adminMode) { const ok = await ensureBoundOrRedirect(); if (!ok) return }
    await this.load()
  },
  setTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab, items: [], leaderboard: [], loading: true }, () => this.load())
  },
  format(ts) { return formatDateTime(ts) },
  statusText(s) { return STATUS_TEXT[s] || s },
  async load() {
    this.setData({ loading: true })
    try {
      const tab = this.data.tab
      if (tab === 'leaderboard') {
        const res = await callApi('help.leaderboard', {})
        const MEDALS = ['', '🥇', '🥈', '🥉']
        const items = (res.items || []).map(item => ({
          ...item,
          rankDisplay: item.rank <= 3 ? MEDALS[item.rank] : item.rank,
          rankClass: item.rank <= 3 ? 'top-' + item.rank : '',
          avatarLetter: (item.nickname || '?')[0],
        }))
        this.setData({ leaderboard: items, loading: false })
      } else if (this.data.adminMode) {
        let status = ''
        if (tab === 'review') status = 'pending_review'
        const res = await callApi('help.list', { status })
        this.setData({ items: res.items || [], loading: false })
      } else {
        const mine = tab === 'mine', takenByMe = tab === 'taken'
        const res = await callApi('help.list', { mine, takenByMe })
        this.setData({ items: res.items || [], loading: false })
      }
    } catch (e) { this.setData({ loading: false }) }
  },
  goCreate() { wx.navigateTo({ url: '/pages/help/create' }) },
  goDetail(e) { wx.navigateTo({ url: `/pages/help/detail?_id=${e.currentTarget.dataset.id}` }) },
  // 管理员审核操作
  async review(e) {
    const id = e.currentTarget.dataset.id; const approve = e.currentTarget.dataset.approve
    try {
      if (approve) {
        // 弹出调整积分
        const item = this.data.items.find(i => i._id === id)
        const curPoints = item ? item.rewardPoints : 0
        wx.showModal({
          title: '确认发布', editable: true, placeholderText: '积分数',
          content: String(curPoints),
          success: async (r) => {
            if (!r.confirm) return
            const pts = Math.max(0, Math.min(999, parseInt(r.content) || curPoints))
            await callApi('help.review', { _id: id, approve: true, rewardPoints: pts })
            wx.showToast({ title: '已发布' })
            this.load()
          },
        })
      } else {
        await callApi('help.review', { _id: id, approve: false })
        wx.showToast({ title: '已拒绝' })
        this.load()
      }
    } catch (err) { wx.showToast({ title: err.message || '操作失败', icon: 'none' }) }
  },
})
