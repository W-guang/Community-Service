const { callApi } = require('../../utils/api')

function roleText(role) {
  if (role === 'admin') return '管理员'
  if (role === 'staff') return '物业/网格员'
  return '居民'
}

Page({
  data: {
    user: { openid: '', role: 'resident', nickname: '', phone: '', elderMode: false },
    roleText: '居民',
    isStaff: false,
    adminMode: false,
    form: { nickname: '', phone: '', elderMode: false },
    saving: false,
    stats: null,
  },
  async onShow() {
    await this.load()
  },
  async load() {
    try {
      const res = await callApi('auth')
      const app = getApp()
      app.globalData.user = res.user
      app.globalData.bindings = res.bindings || { boundCount: 0, houses: [] }
      const adminMode = app.isAdminMode ? app.isAdminMode() : false
      this.setUser(res.user)
      this.setData({ adminMode })
      if (adminMode) await this.loadStats()
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
  setUser(u) {
    this.setData({
      user: u,
      roleText: roleText(u.role),
      isStaff: u.role === 'staff' || u.role === 'admin',
      form: { nickname: u.nickname || '', phone: u.phone || '', elderMode: !!u.elderMode },
    })
  },
  toggleAdminMode() {
    const app = getApp()
    const next = app.toggleAdminMode()
    this.setData({ adminMode: next })
    if (next) {
      this.loadStats()
    }
  },
  async loadStats() {
    try {
      const res = await callApi('dashboard.stats')
      this.setData({ stats: res })
    } catch (_) {
      this.setData({ stats: null })
    }
  },
  onNick(e) {
    this.setData({ 'form.nickname': e.detail.value })
  },
  onPhone(e) {
    this.setData({ 'form.phone': e.detail.value })
  },
  onElder(e) {
    this.setData({ 'form.elderMode': !!e.detail.value })
  },
  async save() {
    if (this.data.saving) return
    this.setData({ saving: true })
    try {
      const res = await callApi('user.update', { ...this.data.form })
      const app = getApp()
      app.globalData.user = res.user
      this.setUser(res.user)
      wx.showToast({ title: '已保存' })
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },
  async wxLogin() {
    try {
      const profile = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善个人资料（昵称、头像）',
          success: resolve,
          fail: reject,
        })
      })
      const { userInfo } = profile || {}
      const res = await callApi('user.update', {
        nickname: (userInfo && userInfo.nickName) || '',
        avatarUrl: (userInfo && userInfo.avatarUrl) || '',
      })
      const app = getApp()
      app.globalData.user = res.user
      if (res.bindings) app.globalData.bindings = res.bindings
      this.setUser(res.user)
      wx.showToast({ title: '已更新' })
    } catch (e) {
      if (e && e.errMsg && e.errMsg.includes('cancel')) {
        wx.showToast({ title: '已取消', icon: 'none' })
      } else {
        wx.showToast({ title: e.message || '授权失败', icon: 'none' })
      }
    }
  },
  goHouses() {
    wx.navigateTo({ url: '/pages/house/list' })
  },
  go(e) {
    const url = e.currentTarget.dataset.url
    wx.navigateTo({ url })
  },
  async sos() {
    try {
      const loc = await this.pickLocation()
      await callApi('sos.create', { location: loc, note: '老人模式一键求助' })
      wx.showModal({
        title: '已发出求助',
        content: '请保持电话畅通，工作人员会尽快联系并上门。',
        showCancel: false,
      })
    } catch (e) {
      wx.showToast({ title: e.message || '求助失败', icon: 'none' })
    }
  },
  pickLocation() {
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        success: (r) => resolve({ latitude: r.latitude, longitude: r.longitude }),
        fail: () => resolve(null),
      })
    })
  },
})
