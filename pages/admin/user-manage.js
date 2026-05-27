const { callApi } = require('../../utils/api')

Page({
  data: {
    roles: ['resident', 'staff', 'admin'],
    roleIndex: 1,
    form: { openid: '', managedCommunities: '' },
    saving: false,
    // 用户列表
    users: [],
    usersTotal: 0,
    userFilterRole: '',
    userKeyword: '',
    loadingUsers: false,
  },
  async onShow() {
    await this.loadUsers()
  },
  // ---- 用户列表 ----
  async loadUsers() {
    this.setData({ loadingUsers: true })
    try {
      const params = {}
      if (this.data.userFilterRole) params.role = this.data.userFilterRole
      const res = await callApi('admin.userList', { ...params, pageSize: 50 })
      const users = (res.items || []).map((u) => ({
        ...u,
        roleText: u.role === 'admin' ? '管理员' : u.role === 'staff' ? '网格员' : '居民',
        timeText: u.createdAt ? new Date(u.createdAt).toLocaleString() : '-',
      }))
      // 如果有关键词，客户端过滤（openid/昵称模糊匹配）
      let filtered = users
      if (this.data.userKeyword) {
        const kw = this.data.userKeyword.toLowerCase()
        filtered = users.filter((u) =>
          (u.openid && u.openid.toLowerCase().includes(kw)) ||
          (u.nickname && u.nickname.toLowerCase().includes(kw))
        )
      }
      this.setData({ users: filtered, usersTotal: res.total || 0, loadingUsers: false })
    } catch (e) {
      this.setData({ loadingUsers: false })
    }
  },
  onFilterRole(e) {
    const role = e.currentTarget.dataset.role
    this.setData({ userFilterRole: this.data.userFilterRole === role ? '' : role }, () => this.loadUsers())
  },
  onSearchInput(e) {
    this.setData({ userKeyword: e.detail.value })
  },
  onSearch() {
    this.loadUsers()
  },
  // ---- 角色设置 ----
  onPickRole(e) {
    this.setData({ roleIndex: Number(e.detail.value || 0) })
  },
  onInput(e) {
    const k = e.currentTarget.dataset.k
    this.setData({ [`form.${k}`]: e.detail.value })
  },
  quickSet(e) {
    const u = e.currentTarget.dataset.user
    const roleIdx = this.data.roles.indexOf(u.role)
    this.setData({
      form: { openid: u.openid, managedCommunities: (u.managedCommunities || []).join(',') },
      roleIndex: roleIdx >= 0 ? roleIdx : 0,
    })
  },
  async save() {
    if (this.data.saving) return
    const openid = (this.data.form.openid || '').trim()
    if (!openid) return wx.showToast({ title: '请填写 openid', icon: 'none' })
    const role = this.data.roles[this.data.roleIndex]
    const managedCommunities =
      role === 'staff'
        ? (this.data.form.managedCommunities || '').split(',').map((s) => s.trim()).filter(Boolean)
        : []
    this.setData({ saving: true })
    try {
      await callApi('admin.userSetRole', { openid, role, managedCommunities })
      wx.showToast({ title: '已保存' })
      this.loadUsers()
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },
  // ---- 管理员白名单 ----
  async addAdmin() {
    const openid = (this.data.form.openid || '').trim()
    if (!openid) return wx.showToast({ title: '请先填写 openid', icon: 'none' })
    try {
      await callApi('admin.add', { openid })
      wx.showToast({ title: '已添加管理员', icon: 'success' })
      this.loadUsers()
    } catch (e) {
      wx.showToast({ title: e.message || '添加失败', icon: 'none' })
    }
  },
  async removeAdmin(e) {
    const openid = e.currentTarget.dataset.openid
    try {
      const res = await new Promise((resolve) => {
        wx.showModal({
          title: '确认移除',
          content: `确定移除管理员 ${openid} 吗？`,
          success: resolve,
        })
      })
      if (!res.confirm) return
      await callApi('admin.remove', { openid })
      wx.showToast({ title: '已移除', icon: 'success' })
      this.loadUsers()
    } catch (e) {
      wx.showToast({ title: e.message || '移除失败', icon: 'none' })
    }
  },
})
