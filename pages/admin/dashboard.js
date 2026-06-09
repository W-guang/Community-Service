const { callApi } = require('../../utils/api')
const { formatDateTime } = require('../../utils/time')

Page({
  data: {
    loading: false,
    exporting: false,
    stats: null,
    exportResult: '',
    repairRate: 0,
    helpRate: 0,
    totalPending: 0,

    // ── 环形图：报修工单状态分布 ──
    repairStatusData: [
      { label: '待受理', value: 15, color: '#f59e0b' },
      { label: '处理中', value: 25, color: '#1296db' },
      { label: '待确认', value: 10, color: '#60a5fa' },
      { label: '已完成', value: 150, color: '#10b981' },
    ],
    totalRepairs: 0,

    // ── 横向柱状图 ──
    helpTypeData: [
      { label: '代买代办', value: 45 },
      { label: '物品借用', value: 30 },
      { label: '寻物启事', value: 20 },
      { label: '顺风拼车', value: 15 },
    ],

    // ── 折线图 ──
    trendLabels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    trendData: [12, 19, 15, 25, 22, 35, 40],
  },

  onLoad() {
    this._initChartData()
  },

  async onShow() {
    await this.load()
  },

  format(ts) {
    return formatDateTime(ts)
  },

  /* ================================================================
     数据加载
     ================================================================ */
  async load() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const res = await callApi('dashboard.stats', {})
      const rt = res.repairs.total || 0
      const rd = res.repairs.done || 0
      const ht = res.helps.total || 0
      const hd = res.helps.done || 0
      this.setData({
        stats: res,
        repairRate: rt > 0 ? Math.round(rd / rt * 100) : 0,
        helpRate: ht > 0 ? Math.round(hd / ht * 100) : 0,
        totalPending: (res.repairs.pending || 0) + (res.helps.open || 0) + (res.sos.pending || 0),
      })
      // 统计数据加载后重新绘制图表
      this._initCharts()
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  /* ================================================================
     图表数据预计算
     ================================================================ */
  _initChartData() {
    const total = this.data.repairStatusData.reduce((s, d) => s + d.value, 0)
    const repairStatusData = this.data.repairStatusData.map(d => ({
      ...d,
      pct: total > 0 ? (d.value / total * 100).toFixed(1) : '0.0',
    }))

    const maxVal = Math.max(...this.data.helpTypeData.map(d => d.value), 1)
    const helpTypeData = this.data.helpTypeData.map(d => ({
      ...d,
      barWidth: (d.value / maxVal * 100).toFixed(1),
    }))

    this.setData({ totalRepairs: total, repairStatusData, helpTypeData })
  },

  /* ================================================================
     Canvas 2D 图表初始化
     ================================================================ */
  _initCharts() {
    // 延迟确保 DOM 就绪
    setTimeout(() => {
      this._drawDonut()
      this._drawLine()
    }, 400)
  },

  /* ---- 环形图 ---- */
  _drawDonut() {
    const query = wx.createSelectorQuery()
    query.select('#donutCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getSystemInfoSync().pixelRatio || 2
      const w = res[0].width
      const h = res[0].height
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)

      const data = this.data.repairStatusData
      const total = this.data.totalRepairs
      const cx = w / 2
      const cy = h / 2
      const outerR = Math.min(w, h) / 2 - 6
      const innerR = outerR * 0.55

      ctx.clearRect(0, 0, w, h)

      let startAngle = -Math.PI / 2
      data.forEach(item => {
        const sweep = (item.value / total) * 2 * Math.PI
        if (sweep <= 0) return
        ctx.beginPath()
        ctx.arc(cx, cy, outerR, startAngle, startAngle + sweep)
        ctx.arc(cx, cy, innerR, startAngle + sweep, startAngle, true)
        ctx.closePath()
        ctx.fillStyle = item.color
        ctx.fill()
        // 1px 白缝
        ctx.beginPath()
        ctx.arc(cx, cy, outerR, startAngle + sweep, startAngle + sweep + 0.008)
        ctx.arc(cx, cy, innerR, startAngle + sweep + 0.008, startAngle + sweep, true)
        ctx.closePath()
        ctx.fillStyle = '#ffffff'
        ctx.fill()
        startAngle += sweep
      })

      ctx.fillStyle = '#1e293b'
      ctx.font = 'bold 18px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(total), cx, cy - 6)
      ctx.font = '11px sans-serif'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText('工单总数', cx, cy + 16)
    })
  },

  /* ---- 折线图 ---- */
  _drawLine() {
    const query = wx.createSelectorQuery()
    query.select('#lineCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getSystemInfoSync().pixelRatio || 2
      const w = res[0].width
      const h = res[0].height
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)

      const data = this.data.trendData
      const labels = this.data.trendLabels
      const maxVal = Math.max(...data, 1)
      const pad = { t: 24, r: 20, b: 36, l: 36 }
      const cw = w - pad.l - pad.r
      const ch = h - pad.t - pad.b

      ctx.clearRect(0, 0, w, h)

      // Y 轴网格
      const ySteps = 4
      for (let i = 0; i <= ySteps; i++) {
        const y = pad.t + (ch / ySteps) * i
        ctx.beginPath()
        ctx.setLineDash([3, 5])
        ctx.moveTo(pad.l, y)
        ctx.lineTo(w - pad.r, y)
        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.setLineDash([])
        const val = Math.round(maxVal - (maxVal / ySteps) * i)
        ctx.fillStyle = '#94a3b8'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(val), pad.l - 8, y)
      }

      // 数据点
      const points = data.map((v, i) => ({
        x: pad.l + (i / (data.length - 1)) * cw,
        y: pad.t + ch - (v / maxVal) * ch,
        value: v,
      }))

      // 面积渐变
      const gradient = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch)
      gradient.addColorStop(0, 'rgba(18,150,219,0.18)')
      gradient.addColorStop(0.6, 'rgba(18,150,219,0.04)')
      gradient.addColorStop(1, 'rgba(18,150,219,0.00)')
      ctx.beginPath()
      ctx.moveTo(points[0].x, pad.t + ch)
      for (let i = 0; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
      ctx.lineTo(points[points.length - 1].x, pad.t + ch)
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()

      // 贝塞尔曲线
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        const cx1 = points[i - 1].x + (points[i].x - points[i - 1].x) * 0.5
        const cx2 = points[i].x - (points[i].x - points[i - 1].x) * 0.5
        ctx.bezierCurveTo(cx1, points[i - 1].y, cx2, points[i].y, points[i].x, points[i].y)
      }
      ctx.strokeStyle = '#1296db'
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.stroke()

      // 数据点
      points.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 2 * Math.PI); ctx.fillStyle = '#ffffff'; ctx.fill()
        ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, 2 * Math.PI); ctx.fillStyle = '#1296db'; ctx.fill()
      })

      // X 轴标签
      ctx.fillStyle = '#64748b'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      points.forEach((p, i) => ctx.fillText(labels[i], p.x, pad.t + ch + 10))

      // 数值标注
      ctx.fillStyle = '#1e293b'
      ctx.font = 'bold 10px sans-serif'
      ctx.textBaseline = 'bottom'
      points.forEach(p => ctx.fillText(String(p.value), p.x, p.y - 10))
    })
  },

  /* ================================================================
     导出
     ================================================================ */
  async exportData(e) {
    const type = e.currentTarget.dataset.type || 'all'
    this.setData({ exporting: true })
    try {
      wx.showLoading({ title: '导出中...' })
      const res = await callApi('dashboard.export', { type })
      wx.hideLoading()
      const summary = res.summary
      const text =
        `导出类型: ${type}\n` +
        `报修: ${summary.repairs} | 互助: ${summary.helps} | 公告: ${summary.notices}\n` +
        `SOS: ${summary.sos} | 用户: ${summary.users}\n` +
        `导出时间: ${new Date(res.exportedAt).toLocaleString()}\n` +
        (res.repairs ? `\n报修数据(${res.repairs.length}条):\n${JSON.stringify(res.repairs.slice(0, 5), null, 2)}\n...` : '')
      this.setData({ exportResult: text })
      wx.showToast({ title: '导出成功', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '导出失败', icon: 'none' })
    } finally {
      this.setData({ exporting: false })
    }
  },
})
