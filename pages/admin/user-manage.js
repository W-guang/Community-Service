const { callApi } = require('../../utils/api')

Page({
  data: {
    roles: ['resident', 'staff', 'admin'],
    roleIndex: 1,
    form: {
      openid: '',
      managedCommunities: '',
    },
    saving: false,
  },
  onPickRole(e) {
    this.setData({ roleIndex: Number(e.detail.value || 0) })
  },
  onInput(e) {
    const k = e.currentTarget.dataset.k
    this.setData({ [`form.${k}`]: e.detail.value })
  },
  async save() {
    if (this.data.saving) return
    const openid = (this.data.form.openid || '').trim()
    if (!openid) return wx.showToast({ title: '请填写 openid', icon: 'none' })
    const role = this.data.roles[this.data.roleIndex]
    const managedCommunities =
      role === 'staff'
        ? (this.data.form.managedCommunities || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []

    this.setData({ saving: true })
    try {
      await callApi('admin.userSetRole', { openid, role, managedCommunities })
      wx.showToast({ title: '已保存' })
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },
})

