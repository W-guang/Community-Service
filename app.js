// app.js
App({
  globalData: {
    cloudEnvId: 'cloud1-d1g0km82f2a64d6fd',
    user: null,
  },
  onLaunch() {
    if (!wx.cloud) return
    wx.cloud.init({
      env: this.globalData.cloudEnvId,
      traceUser: true,
    })
  },
})
