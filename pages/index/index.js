const { callApi } = require('../../utils/api')

function roleText(role) {
  if (role === 'admin') return '管理员'
  if (role === 'staff') return '物业/网格员'
  return '居民'
}

function buildGreeting() {
  const now = new Date()
  const h = now.getHours()
  let text = '早上好'
  if (h >= 12 && h < 18) text = '下午好'
  if (h >= 18 || h < 6) text = '晚上好'
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]}`
  return { greetingText: text, todayDate: dateStr }
}

Page({
  data: {
    user: null, roleText: '居民', authed: false, boundCount: 0,
    noticeList: [], loading: true, elderMode: false,
    adminMode: false, adminStats: null,
    greetingText: '', todayDate: '',
  },
  async onShow() {
    await this.ensureAuth()
    const app = getApp()
    const isStaff = app.globalData.user && (app.globalData.user.role === 'staff' || app.globalData.user.role === 'admin')
    const adminMode = app.isAdminMode ? app.isAdminMode() : false
    this.setData({ adminMode, isStaff, ...buildGreeting() })
    if (adminMode) {
      this.setData({ loading: false })
      this.loadAdminStats()
    } else {
      await this.loadNotices()
    }
  },
  async ensureAuth() {
    try {
      const res = await callApi('auth')
      const app = getApp()
      app.setUserAndMode(res.user)
      app.globalData.bindings = res.bindings || { boundCount: 0, houses: [] }
      this.setData({
        user: res.user, roleText: roleText(res.user.role), authed: !!res.user,
        boundCount: (res.bindings && res.bindings.boundCount) || 0,
        elderMode: !!(res.user && res.user.elderMode),
      })
    } catch (e) { this.setData({ loading: false }) }
  },
  async loadAdminStats() {
    try { const res = await callApi('dashboard.stats'); this.setData({ adminStats: res }) } catch (_) {}
  },
  async loadNotices() {
    try {
      if (!this.data.authed || this.data.boundCount === 0) { this.setData({ loading: false }); return }
      const res = await callApi('notice.list', { pageSize: 5 })
      this.setData({ noticeList: (res.items || []).map(n => ({ id: n._id, title: n.title, isUrgent: !!n.important })), loading: false })
    } catch (e) { this.setData({ loading: false }) }
  },
  async wxLogin() {
    try {
      const profile = await new Promise((resolve, reject) => {
        wx.getUserProfile({ desc: '用于完善个人资料（昵称、头像）', success: resolve, fail: reject })
      })
      const { userInfo } = profile || {}
      const res = await callApi('user.update', { nickname: (userInfo && userInfo.nickName) || '', avatarUrl: (userInfo && userInfo.avatarUrl) || '' })
      const app = getApp()
      app.setUserAndMode(res.user)
      if (res.bindings) app.globalData.bindings = res.bindings
      this.setData({ user: res.user, roleText: roleText(res.user.role), authed: true, boundCount: (res.bindings && res.bindings.boundCount) || 0 })
      wx.showToast({ title: '登录成功', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: (e && e.errMsg && e.errMsg.includes('cancel')) ? '已取消' : (e.message || '登录失败'), icon: 'none' })
    }
  },
  goToNotice(e) { wx.navigateTo({ url: `/pages/notices/detail?_id=${e.currentTarget.dataset.id}` }) },
  goRepair() { wx.switchTab({ url: '/pages/repair/list' }) },
  goHelp() { wx.switchTab({ url: '/pages/help/list' }) },
  goNotices() { wx.switchTab({ url: '/pages/notices/list' }) },
  goBind() { wx.navigateTo({ url: '/pages/house/bind' }) },
  goGift() { wx.navigateTo({ url: '/pages/gift/list' }) },
  go(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }) },
  async sos() {
    try {
      const loc = await new Promise(resolve => { wx.getLocation({ type: 'gcj02', success: r => resolve({ latitude: r.latitude, longitude: r.longitude }), fail: () => resolve(null) }) })
      await callApi('sos.create', { location: loc, note: '' })
      wx.showModal({ title: '已发出求助', content: '物业/网格员将看到求助信息并跟进处理。', showCancel: false })
    } catch (e) { if (e && e.message) wx.showToast({ title: e.message, icon: 'none' }) }
  },
})
