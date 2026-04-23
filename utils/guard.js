const { callApi } = require('./api')

async function ensureAuthed() {
  const app = getApp()
  if (app.globalData.user) return app.globalData.user
  const res = await callApi('auth')
  app.globalData.user = res.user
  app.globalData.bindings = res.bindings || { boundCount: 0, houses: [] }
  return res.user
}

async function ensureBoundOrRedirect(opts = {}) {
  const { redirectUrl = '/pages/house/bind' } = opts
  const app = getApp()
  if (!app.globalData.user || !app.globalData.bindings) {
    await ensureAuthed()
  }
  const boundCount = (app.globalData.bindings && app.globalData.bindings.boundCount) || 0
  if (boundCount > 0) return true

  await new Promise((resolve) => {
    wx.showModal({
      title: '请先绑定房屋',
      content: '绑定后才能使用报修、公告、互助等核心功能。',
      confirmText: '去绑定',
      cancelText: '暂不',
      success: (r) => {
        if (r.confirm) wx.navigateTo({ url: redirectUrl })
        resolve()
      },
    })
  })
  return false
}

module.exports = {
  ensureAuthed,
  ensureBoundOrRedirect,
}

