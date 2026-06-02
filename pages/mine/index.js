const { callApi } = require('../../utils/api')

function roleText(role) {
  if (role === 'admin') return '管理员'
  if (role === 'staff') return '物业/网格员'
  return '居民'
}

// 爱心商城8种礼品 + 交错"谢谢惠顾" = 16扇区
// 越贵重weight越小(区越小难抽到)
const WHEEL_ITEMS = [
  { name: '5L花生油',   w: 1,  color: '#d63031' },
  { name: '谢谢惠顾',   w: 5,  color: '#95a5a6' },
  { name: '大米5kg',     w: 2,  color: '#e67e22' },
  { name: '谢谢惠顾',   w: 5,  color: '#95a5a6' },
  { name: '蒸汽眼罩',   w: 3,  color: '#9b59b6' },
  { name: '谢谢惠顾',   w: 5,  color: '#95a5a6' },
  { name: '洗衣液3kg',  w: 3,  color: '#2ecc71' },
  { name: '谢谢惠顾',   w: 5,  color: '#95a5a6' },
  { name: '抽纸套装',   w: 4,  color: '#3498db' },
  { name: '谢谢惠顾',   w: 5,  color: '#95a5a6' },
  { name: '10元抵扣券', w: 4,  color: '#f1c40f' },
  { name: '谢谢惠顾',   w: 5,  color: '#95a5a6' },
  { name: '口罩50只',    w: 6,  color: '#1abc9c' },
  { name: '谢谢惠顾',   w: 5,  color: '#95a5a6' },
  { name: '5元抵扣券',   w: 8,  color: '#3498db' },
  { name: '谢谢惠顾',   w: 5,  color: '#95a5a6' },
]
const TOTAL_W = WHEEL_ITEMS.reduce((s, p) => s + p.w, 0)

Page({
  data: {
    user: { openid: '', role: 'resident', nickname: '', phone: '', elderMode: false },
    roleText: '居民', isStaff: false, adminMode: false,
    form: { nickname: '', phone: '', elderMode: false }, saving: false, stats: null,
    showEdit: false,
    adminMenus: [
      { url: '/pages/admin/todo', icon: '📋', name: '待办处理', desc: '报修工单与SOS求助' },
      { url: '/pages/admin/notice-manage', icon: '📢', name: '公告管理', desc: '发布与编辑社区公告' },
      { url: '/pages/admin/user-manage', icon: '👥', name: '用户管理', desc: '角色分配与白名单' },
      { url: '/pages/admin/house-verify', icon: '✅', name: '房屋核验', desc: '审核绑定申请' },
      { url: '/pages/admin/house-manage', icon: '🏠', name: '房屋录入', desc: '录入小区房屋信息' },
      { url: '/pages/admin/dashboard', icon: '📈', name: '数据看板', desc: '详细统计与报表导出' },
    ],
    // 转盘相关（从服务端获取真实数据）
    lotteryShow: false, lotterySpinning: false,
    lotteryResult: '', lotteryRemain: 0, wheelDeg: 0,
    lotteryPoints: 0, lotterySpinCost: 10,
    _currentDeg: 0, _spinTimer: null, _drawn: false,
  },

  async onShow() { await this.load() },
  async load() {
    try {
      const res = await callApi('auth')
      const app = getApp()
      app.setUserAndMode(res.user)
      app.globalData.bindings = res.bindings || { boundCount: 0, houses: [] }
      const adminMode = app.isAdminMode ? app.isAdminMode() : false
      this.setUser(res.user)
      this.setData({ adminMode })
      if (adminMode) await this.loadStats()
    } catch (e) { }
  },
  setUser(u) {
    this.setData({ user: u, roleText: roleText(u.role),
      isStaff: u.role === 'staff' || u.role === 'admin',
      form: { nickname: u.nickname || '', phone: u.phone || '', elderMode: !!u.elderMode } })
  },
  toggleAdminMode() { const app = getApp(); const n = app.toggleAdminMode(); this.setData({ adminMode: n }); if (n) this.loadStats() },
  async loadStats() { try { this.setData({ stats: await callApi('dashboard.stats') }) } catch (_) {} },
  onNick(e) { this.setData({ 'form.nickname': e.detail.value }) },
  onPhone(e) { this.setData({ 'form.phone': e.detail.value }) },
  onElder(e) { this.setData({ 'form.elderMode': !!e.detail.value }) },
  async save() {
    if (this.data.saving) return; this.setData({ saving: true })
    try { const res = await callApi('user.update', { ...this.data.form }); getApp().globalData.user = res.user; this.setUser(res.user); wx.showToast({ title: '已保存' }) }
    catch (e) { wx.showToast({ title: e.message || '保存失败', icon: 'none' }) }
    finally { this.setData({ saving: false }) }
  },
  async wxLogin() { /* 保持原样 */ },
  toggleEdit() { this.setData({ showEdit: !this.data.showEdit }) },
  goGift() { wx.navigateTo({ url: '/pages/gift/list' }) },
  goHouses() { wx.navigateTo({ url: '/pages/house/list' }) },
  go(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }) },
  async sos() { /* 保持原样 */ },

  // ========== 转盘 (Canvas 2D 同层渲染) ==========
  async openLottery() {
    this._drawn = false
    // 先从服务端获取最新积分和剩余次数
    let remainInfo = { totalPoints: this.data.user.totalPoints || 0, todayRemain: 999, spinCost: 0 }
    try {
      const res = await callApi('lottery.remain')
      remainInfo = res
    } catch (_) { /* 接口异常时使用本地缓存值 */ }

    this.setData({
      lotteryShow: true,
      lotteryResult: '',
      lotteryRemain: remainInfo.todayRemain,
      lotteryPoints: remainInfo.totalPoints,
      lotterySpinCost: remainInfo.spinCost,
      wheelDeg: this._currentDeg,
    })

    // 同步更新用户积分
    if (!this.data.user.totalPoints || this.data.user.totalPoints !== remainInfo.totalPoints) {
      this.setData({ 'user.totalPoints': remainInfo.totalPoints })
    }

    // 等 DOM 渲染完 Canvas 节点再绘制
    setTimeout(() => {
      wx.createSelectorQuery().select('#wheelCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) return
          this._drawWheel2d(res[0])
        })
    }, 300)
  },
  closeLottery() {
    // 清理定时器，防止关闭后仍然弹出toast
    clearTimeout(this._spinTimer)
    this.setData({ lotteryShow: false, lotteryResult: '' })
  },
  nop() {},

  _drawWheel2d(canvasInfo) {
    if (this._drawn) return
    const canvas = canvasInfo.node
    const ctx = canvas.getContext('2d')
    const dpr = wx.getSystemInfoSync().pixelRatio
    const size = canvasInfo.width
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2, cy = size / 2, R = size / 2; let sa = 0
    WHEEL_ITEMS.forEach(p => {
      const ang = (p.w / TOTAL_W) * 2 * Math.PI, ea = sa + ang
      ctx.beginPath(); ctx.arc(cx, cy, R, sa, ea); ctx.lineTo(cx, cy); ctx.closePath()
      ctx.fillStyle = p.color; ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke()
      const mid = sa + ang / 2; ctx.save(); ctx.translate(cx, cy); ctx.rotate(mid)
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText(p.name, R - 18, 0); ctx.restore()
      p._start = sa; p._end = ea; sa = ea
    })
    this._drawn = true
  },

  async doLottery() {
    if (this.data.lotterySpinning) return

    // 1. 先调用后端抽奖，获取服务端确定的结果
    this.setData({ lotterySpinning: true, lotteryResult: '' })
    let spinResult = null
    try {
      spinResult = await callApi('lottery.spin')
    } catch (e) {
      this.setData({ lotterySpinning: false })
      wx.showToast({ title: e.message || '抽奖失败', icon: 'none' })
      return
    }

    // 2. 根据服务端返回的 prizeIndex 计算转盘目标角度
    const prizeIndex = spinResult.prizeIndex
    const sector = WHEEL_ITEMS[prizeIndex]
    // 指针在顶部(1.5*PI)，计算使该扇区对准指针所需的模360角度
    const midAngle = (sector._start + sector._end) / 2
    let targetNdDeg = (1.5 * Math.PI - midAngle) * 180 / Math.PI
    // 加入微量随机偏移（在该扇区内），避免每次停在完全相同位置
    const sectorDeg = ((sector._end - sector._start) * 180 / Math.PI) * 0.6
    targetNdDeg += (Math.random() - 0.5) * sectorDeg
    if (targetNdDeg < 0) targetNdDeg += 360

    // 3. 叠加 5~8 圈随机整圈 + 精确目标角度
    const fullSpins = (Math.floor(Math.random() * 4) + 5) * 360
    const base = fullSpins + targetNdDeg - (this._currentDeg % 360)
    this._currentDeg += base
    this.setData({ wheelDeg: this._currentDeg })

    // 4. 等待动画结束(6s)，显示结果
    clearTimeout(this._spinTimer)
    this._spinTimer = setTimeout(() => {
      this.setData({
        lotterySpinning: false,
        lotteryResult: spinResult.isWin ? spinResult.prizeName : '谢谢惠顾',
        lotteryRemain: spinResult.todayRemain,
        lotteryPoints: spinResult.pointsAfter,
        'user.totalPoints': spinResult.pointsAfter,
      })
      wx.showToast({
        title: spinResult.isWin ? '🎉 抽中：' + spinResult.prizeName : '谢谢惠顾~',
        icon: 'none',
      })
    }, 6200)
  },
  onUnload() { clearTimeout(this._spinTimer) }
})
