const { callApi } = require('../../utils/api')
const { ensureAuthed } = require('../../utils/guard')

function roleText(role) {
  if (role === 'admin') return '管理员'
  if (role === 'staff') return '物业/网格员'
  return '居民'
}

Page({
  data: {
    user: null,
    roleText: '居民',
    authed: false,
    boundCount: 0,
    noticeList: [
      {
        id: 1,
        title: '社区物业服务中心搬迁通知',
        isUrgent: false
      },
      {
        id: 2,
        title: '停水通知：明日9:00-18:00管道维护',
        isUrgent: true
      },
      {
        id: 3,
        title: '社区健康体检活动报名开始',
        isUrgent: false
      }
    ]
  },
  async onShow() {
    await this.ensureAuth()
  },
  async ensureAuth() {
    try {
      const res = await callApi('auth')
      const app = getApp()
      app.globalData.user = res.user
      app.globalData.bindings = res.bindings || { boundCount: 0, houses: [] }
      this.setData({ user: res.user, roleText: roleText(res.user.role) })
      this.setData({ authed: !!res.user, boundCount: (res.bindings && res.bindings.boundCount) || 0 })
    } catch (e) {
      wx.showToast({ title: e.message || '初始化失败', icon: 'none' })
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
      await ensureAuthed()
      const res = await callApi('user.update', {
        nickname: (userInfo && userInfo.nickName) || '',
        avatarUrl: (userInfo && userInfo.avatarUrl) || '',
      })
      const app = getApp()
      app.globalData.user = res.user
      if (res.bindings) app.globalData.bindings = res.bindings
      this.setData({
        user: res.user,
        roleText: roleText(res.user.role),
        authed: true,
        boundCount: (res.bindings && res.bindings.boundCount) || 0,
      })
      wx.showToast({ title: '登录成功', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: e.message || '登录失败', icon: 'none' })
    }
  },
  // 公告点击事件
  goToNotice(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/notices/detail?id=${id}`
    })
  },
  goRepair() {
    wx.switchTab({ url: '/pages/repair/list' })
  },
  goHelp() {
    wx.switchTab({ url: '/pages/help/list' })
  },
  goNotices() {
    wx.switchTab({ url: '/pages/notices/list' })
  },
  goBind() {
    wx.navigateTo({ url: '/pages/house/bind' })
  },
  async sos() {
    try {
      const loc = await this.pickLocation()
      await callApi('sos.create', { location: loc, note: '' })
      wx.showModal({
        title: '已发出求助',
        content: '物业/网格员将看到求助信息并跟进处理。',
        showCancel: false,
      })
    } catch (e) {
      if (e && e.message) wx.showToast({ title: e.message, icon: 'none' })
    }
  },
  pickLocation() {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        success: (r) => resolve({ latitude: r.latitude, longitude: r.longitude }),
        fail: () => resolve(null),
      })
    })
  },
})
