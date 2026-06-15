const { callApi } = require('../../utils/api')

// 券面色板：折扣类暖色，减免类冷色
const COLORS = {
  discount: ['#ef4444', '#f59e0b', '#f97316', '#dc2626'],
  deduct:   ['#6366f1', '#8b5cf6'],
  points:   ['#3b82f6', '#10b981'],
}

Page({
  data: {
    categories: ['全部', '物业折扣', '生活缴费', '积分减免'],
    activeCategory: '全部',
    userPoints: 0,
    items: [
      // ===== 物业折扣券 =====
      {
        id: 'd1', name: '物业费折扣券', desc: '缴纳物业费时享受9折优惠（最高减50元）',
        value: '9', unit: '折', label: '最高减50元',
        points: 60, color: COLORS.discount[0],
        expire: '2026-12-31', cat: '物业折扣', claimed: false,
      },
      {
        id: 'd2', name: '物业费折扣券', desc: '缴纳物业费时享受8.5折优惠（最高减80元）',
        value: '8.5', unit: '折', label: '最高减80元',
        points: 100, color: COLORS.discount[1],
        expire: '2026-12-31', cat: '物业折扣', claimed: false,
      },
      {
        id: 'd3', name: '停车费折扣券', desc: '缴纳小区停车费时享受8折优惠（最高减30元）',
        value: '8', unit: '折', label: '最高减30元',
        points: 80, color: COLORS.discount[2],
        expire: '2026-12-31', cat: '物业折扣', claimed: false,
      },

      // ===== 生活缴费券 =====
      {
        id: 'd4', name: '水费抵扣券', desc: '缴纳水费时直接抵扣10元（无门槛）',
        value: '10', unit: '元', label: '无门槛',
        points: 50, color: COLORS.deduct[0],
        expire: '2026-12-31', cat: '生活缴费', claimed: false,
      },
      {
        id: 'd5', name: '电费抵扣券', desc: '缴纳电费时直接抵扣15元（无门槛）',
        value: '15', unit: '元', label: '无门槛',
        points: 70, color: COLORS.deduct[1],
        expire: '2026-12-31', cat: '生活缴费', claimed: false,
      },
      {
        id: 'd6', name: '燃气费折扣券', desc: '缴纳燃气费时享受9.5折优惠（最高减20元）',
        value: '9.5', unit: '折', label: '最高减20元',
        points: 40, color: COLORS.discount[3],
        expire: '2026-12-31', cat: '生活缴费', claimed: false,
      },

      // ===== 积分减免券（爱心商城兑换礼品时抵扣积分，不可叠加） =====
      {
        id: 'p1', name: '积分减免券', desc: '兑换商城礼品时可少花10积分（不可叠加使用）',
        value: '10', unit: '积分', label: '礼品兑换专用',
        points: 1, color: COLORS.points[0],
        expire: '2026-12-31', cat: '积分减免', claimed: false,
      },
      {
        id: 'p2', name: '积分减免券', desc: '兑换商城礼品时可少花5积分（不可叠加使用）',
        value: '5', unit: '积分', label: '礼品兑换专用',
        points: 1, color: COLORS.points[1],
        expire: '2026-12-31', cat: '积分减免', claimed: false,
      },
    ]
  },

  onShow() {
    this.filterItems()
    this.loadUserPoints()
  },

  async loadUserPoints() {
    try {
      const res = await callApi('lottery.remain')
      this.setData({ userPoints: res.totalPoints || 0 })
    } catch (_) { }
  },

  filterItems() {
    const cat = this.data.activeCategory
    const items = cat === '全部'
      ? this.data.items
      : this.data.items.filter(i => i.cat === cat)
    this.setData({ filtered: items })
  },

  onTab(e) {
    const cat = e.currentTarget.dataset.cat
    this.setData({ activeCategory: cat })
    this.filterItems()
  },

  onClaim(e) {
    const item = e.currentTarget.dataset.item
    if (item.claimed) return

    // 积分减免券的提示文案
    const isPointsVoucher = item.cat === '积分减免'
    const descLine = isPointsVoucher
      ? '⚠️ 此券不可叠加使用，每次兑换礼品仅限使用一张'
      : item.desc

    wx.showModal({
      title: '确认兑换',
      content: `使用 ${item.points} 积分兑换「${item.name}」？\n${descLine}`,
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '兑换中…', mask: true })
          await callApi('coupon.claim', {
            couponId: item.id, points: item.points, name: item.name,
          })
          wx.hideLoading()
          const items = this.data.items.map(it =>
            it.id === item.id ? { ...it, claimed: true } : it
          )
          this.setData({ items })
          this.filterItems()
          this.loadUserPoints()
          wx.showToast({ title: '兑换成功！', icon: 'success', duration: 2000 })
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: err.message || '兑换失败', icon: 'none', duration: 2000 })
        }
      },
    })
  },
})
