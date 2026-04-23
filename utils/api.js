const APP = getApp()

function getEnv() {
  const app = APP || getApp()
  return (app && app.globalData && app.globalData.cloudEnvId) || undefined
}

async function callApi(action, data = {}) {
  if (!wx.cloud) {
    throw new Error('当前基础库不支持云开发，请在微信开发者工具开启云开发')
  }
  const res = await wx.cloud.callFunction({
    name: 'api',
    data: {
      action,
      data,
    },
    config: {
      env: getEnv(),
    },
  })
  const payload = res && res.result
  if (!payload) throw new Error('云函数返回为空')
  if (payload.ok) return payload.data
  throw new Error(payload.error || '请求失败')
}

module.exports = {
  callApi,
}

