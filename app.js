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
  toggleAdminMode() {
    this.globalData.adminMode = !this.globalData.adminMode
    return this.globalData.adminMode
  },
  isAdminMode() {
    return !!(this.globalData.adminMode && this.globalData.user &&
      (this.globalData.user.role === 'staff' || this.globalData.user.role === 'admin'))
  },
})
