const { callApi } = require('../../utils/api')

Page({
  data: {
    roles: ['resident', 'staff', 'admin'],
    roleIndex: 1,
    form: { openid: '', managedCommunities: '' },
    saving: false,
    users: [], usersTotal: 0, userFilterRole: '', userKeyword: '', loadingUsers: false,
    // 用户详情弹窗
    showDetail: false, detailUser: null, detailHouses: [],
    // 用户房屋映射模式
    showHouseMap: false,
  },
  async onShow() { await this.loadUsers() },
  async loadUsers() {
    this.setData({ loadingUsers: true })
    try {
      const params = {}
      if (this.data.userFilterRole) params.role = this.data.userFilterRole
      let res
      if (this.data.showHouseMap) {
        res = await callApi('admin.userHouseMap', { ...params, pageSize: 50 })
      } else {
        res = await callApi('admin.userList', { ...params, pageSize: 50 })
      }
      const users = (res.items || []).map((u) => ({
        ...u,
        roleText: u.role === 'admin' ? '管理员' : u.role === 'staff' ? '网格员' : '居民',
        timeText: u.createdAt ? new Date(u.createdAt).toLocaleString() : '-',
        houseCount: u.houses ? u.houses.filter(h => h.status === 'bound').length : 0,
      }))
      let filtered = users
      if (this.data.userKeyword) {
        const kw = this.data.userKeyword.toLowerCase()
        filtered = users.filter((u) =>
          (u.openid && u.openid.toLowerCase().includes(kw)) ||
          (u.nickname && u.nickname.toLowerCase().includes(kw))
        )
      }
      this.setData({ users: filtered, usersTotal: res.total || 0, loadingUsers: false })
    } catch (e) { this.setData({ loadingUsers: false }) }
  },
  onFilterRole(e) {
    const role = e.currentTarget.dataset.role
    this.setData({ userFilterRole: this.data.userFilterRole === role ? '' : role }, () => this.loadUsers())
  },
  onSearchInput(e) { this.setData({ userKeyword: e.detail.value }) },
  onSearch() { this.loadUsers() },
  // 统一处理用户点击：房屋映射模式→查看详情，否则→填充角色设置
  onUserTap(e) {
    const openid = e.currentTarget.dataset.openid
    const role = e.currentTarget.dataset.role
    if (this.data.showHouseMap) {
      this.viewUserDetailByOpenid(e)
    } else {
      // quickSet 逻辑
      const roleIdx = ['resident', 'staff', 'admin'].indexOf(role)
      this.setData({
        form: { openid: openid, managedCommunities: '' },
        roleIndex: roleIdx >= 0 ? roleIdx : 0,
      })
    }
  },
  async viewUserDetailByOpenid(e) {
    const openid = e.currentTarget.dataset.openid
    try {
      wx.showLoading({ title: '加载中' })
      const res = await callApi('admin.userDetail', { openid })
      wx.hideLoading()
      // 为房屋计算显示文字
      const houses = (res.houses || []).map(h => {
        let statusText = '未知'
        if (h.status === 'bound') statusText = '已绑定'
        else if (h.status === 'pending_verify') statusText = '待审核'
        else if (h.status === 'rejected') statusText = '已驳回'
        return { ...h, statusText }
      })
      this.setData({ showDetail: true, detailUser: res.user, detailHouses: houses })
    } catch (err) { wx.hideLoading(); wx.showToast({ title: err.message || '加载失败', icon: 'none' }) }
  },
  toggleHouseMap() {
    this.setData({ showHouseMap: !this.data.showHouseMap }, () => this.loadUsers())
  },
  closeDetail() { this.setData({ showDetail: false, detailUser: null, detailHouses: [] }) },

  // 角色设置
  onPickRole(e) { this.setData({ roleIndex: Number(e.detail.value || 0) }) },
  onInput(e) { const k = e.currentTarget.dataset.k; this.setData({ [`form.${k}`]: e.detail.value }) },
  async save() {
    if (this.data.saving) return
    const openid = (this.data.form.openid || '').trim()
    if (!openid) return wx.showToast({ title: '请填写 openid', icon: 'none' })
    const role = this.data.roles[this.data.roleIndex]
    const managedCommunities = role === 'staff' ? (this.data.form.managedCommunities || '').split(',').map(s => s.trim()).filter(Boolean) : []
    this.setData({ saving: true })
    try {
      await callApi('admin.userSetRole', { openid, role, managedCommunities })
      wx.showToast({ title: '已保存' })
      this.loadUsers()
    } catch (e) { wx.showToast({ title: e.message || '保存失败', icon: 'none' }) }
    finally { this.setData({ saving: false }) }
  },
  async addAdmin() {
    const openid = (this.data.form.openid || '').trim()
    if (!openid) return wx.showToast({ title: '请先填写 openid', icon: 'none' })
    try { await callApi('admin.add', { openid }); wx.showToast({ title: '已添加管理员', icon: 'success' }); this.loadUsers() }
    catch (e) { wx.showToast({ title: e.message || '添加失败', icon: 'none' }) }
  },
  async removeAdmin(e) {
    const openid = e.currentTarget.dataset.openid
    try {
      const res = await new Promise(r => wx.showModal({ title: '确认移除', content: `确定移除管理员 ${openid} 吗？`, success: r }))
      if (!res.confirm) return
      await callApi('admin.remove', { openid })
      wx.showToast({ title: '已移除', icon: 'success' })
      this.loadUsers()
    } catch (e) { wx.showToast({ title: e.message || '移除失败', icon: 'none' }) }
  },
})
