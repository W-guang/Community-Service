const { callApi } = require('../../utils/api')

function roleText(role) {
  if (role === 'admin') return '管理员'
  if (role === 'staff') return '物业/网格员'
  return '居民'
}

// 奖品配置 — 霓虹竞技风格：红/金/绿/蓝四色循环 + 白色间隔
const PRIZE_POOL = [
  { name: '5L花生油',   range: 1,  bg: '#ff3b3b' },
  { name: '谢谢惠顾',   range: 1,  bg: '#f2f2f6' },
  { name: '大米5kg',     range: 1,  bg: '#ffd700' },
  { name: '谢谢惠顾',   range: 1,  bg: '#f2f2f6' },
  { name: '蒸汽眼罩',   range: 1,  bg: '#3bff6f' },
  { name: '谢谢惠顾',   range: 1,  bg: '#f2f2f6' },
  { name: '洗衣液3kg',  range: 1,  bg: '#3b9fff' },
  { name: '谢谢惠顾',   range: 1,  bg: '#f2f2f6' },
  { name: '抽纸套装',   range: 1,  bg: '#ff3b3b' },
  { name: '谢谢惠顾',   range: 1,  bg: '#f2f2f6' },
  { name: '食盐1袋',    range: 1,  bg: '#ffd700' },
  { name: '谢谢惠顾',   range: 1,  bg: '#f2f2f6' },
  { name: '一袋口罩',    range: 1,  bg: '#3bff6f' },
  { name: '谢谢惠顾',   range: 1,  bg: '#f2f2f6' },
  { name: '5元抵扣券',   range: 1,  bg: '#3b9fff' },
  { name: '谢谢惠顾',   range: 1,  bg: '#f2f2f6' },
]

function buildPrizes() {
  return PRIZE_POOL.map(p => {
    const isWhite = p.bg === '#f2f2f6'
    return {
      name: p.name,
      background: p.bg,
      range: p.range,
      fonts: [{ text: p.name, top: '10%', fontColor: isWhite ? '#1e293b' : '#ffffff', fontSize: '12px', fontWeight: '700' }]
    }
  })
}

Page({
  data: {
    user: { openid: '', role: 'resident', nickname: '', phone: '', elderMode: false },
    roleText: '居民', isStaff: false, adminMode: false,
    form: { nickname: '', phone: '', elderMode: false }, saving: false,
    // 动态导航栏高度（状态栏 + 胶囊按钮 + 边距）
    navBarHeight: 0,
    // 今日工作简报
    maskedOpenid: '', briefRepairs: 0, briefHelps: 0, briefSos: 0, briefHouses: 0,
    showEdit: false, showEditPopup: false,
    // 转盘相关
    lotteryShow: false, lotterySpinning: false,
    lotteryResult: '', lotteryRemain: 0,
    lotteryPoints: 0, lotterySpinCost: 10,
    // 抽奖记录
    lotteryHistoryShow: false, lotteryHistory: [],

    // ---- lucky-canvas 配置 ----
    prizes: buildPrizes(),
    blocks: [{ padding: '8px', background: '#c0392b' }],
    buttons: [
      { radius: '50%', background: '#c0392b' },
      { radius: '47%', background: '#e74c3c' },
      { radius: '44%', background: '#ffd700' },
      { radius: '38%', background: '#ffffff' },
      { radius: '35%', background: '#ffd700', pointer: true },
      { radius: '30%', background: '#e74c3c' },
      { radius: '24%', background: '#c0392b' }
    ],
    defaultStyle: { fontColor: '#ffffff', fontSize: '13px', fontWeight: 'bold', lineColor: 'rgba(255,215,0,0.35)', lineWidth: '2px' },
  },

  onLoad() {
    // 动态计算导航栏高度：状态栏 + 胶囊按钮 + 上下边距
    const sysInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    // 减去 16px 让内容向上收紧
    const navBarHeight = menuButton.bottom + (menuButton.top - sysInfo.statusBarHeight) - 16
    this.setData({ navBarHeight: Math.max(0, navBarHeight) })
  },

  async onShow() { await this.load() },
  async load() {
    try {
      const res = await callApi('auth')
      const app = getApp()
      app.setUserAndMode(res.user)
      app.globalData.bindings = res.bindings || { boundCount: 0, houses: [] }
      const adminMode = app.isAdminMode ? app.isAdminMode() : false
      const maskedOpenid = (res.user.openid && res.user.openid.length > 10)
        ? res.user.openid.slice(0, 10) + '…'
        : (res.user.openid || '加载中…')
      this.setUser(res.user)
      this.setData({ adminMode, maskedOpenid })
      if (adminMode) this.loadWorkBrief()
    } catch (e) { }
  },
  async loadWorkBrief() {
    try {
      const stats = await callApi('dashboard.stats', {})
      let housePending = 0
      try {
        const hp = await callApi('house.pendingList', {})
        housePending = (hp.items || []).length
      } catch (_) {}
      this.setData({
        briefRepairs: stats.repairs ? stats.repairs.pending : 0,
        briefHelps: stats.helps ? stats.helps.open : 0,
        briefSos: stats.sos ? stats.sos.pending : 0,
        briefHouses: housePending,
      })
    } catch (_) {}
  },
  go(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }) },
  setUser(u) {
    this.setData({ user: u, roleText: roleText(u.role),
      isStaff: u.role === 'staff' || u.role === 'admin',
      form: { nickname: u.nickname || '', phone: u.phone || '', elderMode: !!u.elderMode } })
  },
  toggleAdminMode() { const app = getApp(); const n = app.toggleAdminMode(); this.setData({ adminMode: n }) },
  onNick(e) { this.setData({ 'form.nickname': e.detail.value }) },
  onPhone(e) { this.setData({ 'form.phone': e.detail.value }) },
  async onElder(e) {
    const elderMode = !!e.detail.value
    this.setData({ 'form.elderMode': elderMode, 'user.elderMode': elderMode })
    try {
      const res = await callApi('user.update', { elderMode })
      getApp().globalData.user = res.user
    } catch (_) { /* 即时保存失败不弹提示，下次进入页面时 load() 会纠正 */ }
  },
  async save() {
    if (this.data.saving) return; this.setData({ saving: true })
    try {
      const res = await callApi('user.update', { ...this.data.form })
      getApp().globalData.user = res.user; this.setUser(res.user)
      wx.showToast({ title: '已保存' })
      this.setData({ showEditPopup: false })
    }
    catch (e) { wx.showToast({ title: e.message || '保存失败', icon: 'none' }) }
    finally { this.setData({ saving: false }) }
  },
  async wxLogin() { /* 保持原样 */ },
  toggleEdit() { this.setData({ showEdit: !this.data.showEdit }) },
  openEdit() { this.setData({ showEditPopup: true }) },
  closeEdit() { this.setData({ showEditPopup: false }) },
  goCoupon() { wx.navigateTo({ url: '/pages/coupon/list' }) },
  goGift() { wx.navigateTo({ url: '/pages/gift/list' }) },
  goRedemptions() { wx.navigateTo({ url: '/pages/mine/redemptions' }) },
  goHouses() { wx.navigateTo({ url: '/pages/house/list' }) },
  async sos() { /* 保持原样 */ },
  clearCache() {
    const app = getApp()
    if (app.globalData) app.globalData.bindings = null
    wx.showToast({ title: '缓存已清除', icon: 'success' })
    this.load()
  },

  // ========== 积分转盘（lucky-canvas + 外部按钮） ==========
  _spinning: false,

  async openLottery() {
    let remainInfo = { totalPoints: this.data.user.totalPoints || 0, todayRemain: 999, spinCost: 0 }
    try {
      const res = await callApi('lottery.remain')
      remainInfo = res
    } catch (_) { }
    this.data.lotterySpinning = false
    this.setData({
      lotteryShow: true,
      lotteryResult: '',
      lotteryRemain: remainInfo.todayRemain,
      lotteryPoints: remainInfo.totalPoints,
      lotterySpinCost: remainInfo.spinCost,
    })
    if (!this.data.user.totalPoints || this.data.user.totalPoints !== remainInfo.totalPoints) {
      this.setData({ 'user.totalPoints': remainInfo.totalPoints })
    }
  },
  closeLottery() {
    this.setData({ lotteryShow: false, lotteryResult: '' })
  },
  nop() {},

  // ---- 点击外部"开始抽奖"按钮 ----
  async doLottery() {
    if (this.data.lotterySpinning) return
    this.setData({ lotterySpinning: true, lotteryResult: '' })

    const lucky = this.selectComponent('#myLucky')
    if (!lucky) {
      this.setData({ lotterySpinning: false })
      return wx.showToast({ title: '转盘加载中，请稍后', icon: 'none' })
    }

    // 1. 点击瞬间立刻让转盘先空转起来，给用户即时视觉反馈
    lucky.play()

    // 2. 转盘在转的同时，后台静默发起网络请求
    let spinResult = null
    try {
      spinResult = await callApi('lottery.spin')
    } catch (e) {
      // 异常兜底：停止转盘并重置状态
      lucky.stop(-1)
      this.setData({ lotterySpinning: false })
      return wx.showToast({ title: e.message || '抽奖失败', icon: 'none' })
    }

    // 3. 后端返回后，计算目标扇区并让转盘平滑减速停在对应位置
    const index = PRIZE_POOL.findIndex(p => p.name === spinResult.prizeName)
    lucky.stop(index >= 0 ? index : 0)
  },

  // ---- 抽奖记录 ----
  async openLotteryHistory() {
    this.setData({ lotteryHistoryShow: true, lotteryHistory: [] })
    try {
      const res = await callApi('lottery.history', { pageSize: 30 })
      const { formatDateTime } = require('../../utils/time')
      const lotteryHistory = (res.items || []).map(it => ({
        ...it,
        timeText: formatDateTime(it.createdAt),
      }))
      this.setData({ lotteryHistory })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },
  closeLotteryHistory() {
    this.setData({ lotteryHistoryShow: false })
  },

  // ---- lucky-canvas 转盘停止回调 ----
  onEnd(e) {
    this.setData({ lotterySpinning: false })
    const prize = e.detail
    const isWin = prize.name && prize.name !== '谢谢惠顾'
    this.setData({
      lotteryResult: isWin ? prize.name : '谢谢惠顾',
    })
  },
})
