// app.js
App({
  globalData: {
    cloudEnvId: 'cloud1-d1g0km82f2a64d6fd',
    user: null,
    adminMode: false,
  },
  onLaunch() {
    if (!wx.cloud) return
    wx.cloud.init({
      env: this.globalData.cloudEnvId,
      traceUser: true,
    })
  },
  // 根据角色设置默认模式：admin登录后自动进入管理模式
  setUserAndMode(user) {
    this.globalData.user = user
    if (user && user.role === 'admin') {
      this.globalData.adminMode = true
    }
  },
  toggleAdminMode() {
    this.globalData.adminMode = !this.globalData.adminMode
    return this.globalData.adminMode
  },
  isAdminMode() {
    return !!(this.globalData.adminMode && this.globalData.user &&
      (this.globalData.user.role === 'staff' || this.globalData.user.role === 'admin'))
  },
})
