/**
 * 数据可视化分析页
 * 包含三个图表卡片：环形图（报修状态分布）、横向柱状图（互助类型排行）、折线图（每日报修趋势）
 * Canvas 2D 绘制环形图和折线图，纯 CSS 实现柱状图，完全兼容 Skyline
 */
Page({
  data: {
    // ── 环形图：报修工单状态分布 ──
    repairStatusData: [
      { label: '待受理', value: 15, color: '#f59e0b' },
      { label: '处理中', value: 25, color: '#1296db' },
      { label: '待确认', value: 10, color: '#60a5fa' },
      { label: '已完成', value: 150, color: '#10b981' },
    ],
    totalRepairs: 0, // computed

    // ── 横向柱状图：邻里互助任务类型排行 ──
    helpTypeData: [
      { label: '代买代办', value: 45 },
      { label: '物品借用', value: 30 },
      { label: '寻物启事', value: 20 },
      { label: '顺风拼车', value: 15 },
    ],
    barMaxVal: 0, // computed

    // ── 折线图：每日新增报修趋势 ──
    trendLabels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    trendData: [12, 19, 15, 25, 22, 35, 40],

    // 图表就绪标记
    donutReady: false,
    lineReady: false,
  },

  onLoad() {
    // ── 环形图：预计算百分比和条形图宽度 ──
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

    this.setData({
      totalRepairs: total,
      repairStatusData,
      barMaxVal: maxVal,
      helpTypeData,
    })
  },

  onReady() {
    // DOM 就绪后延迟一帧确保 canvas 节点可查询
    setTimeout(() => {
      this.initDonutChart()
      this.initLineChart()
    }, 300)
  },

  /* ================================================================
     环形图（Donut Chart）— Canvas 2D
     ================================================================ */
  initDonutChart() {
    const query = wx.createSelectorQuery()
    query.select('#donutCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          console.warn('donutCanvas not found')
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio || 2
        const w = res[0].width
        const h = res[0].height

        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)

        this._drawDonut(ctx, w, h)
        this.setData({ donutReady: true })
      })
  },

  _drawDonut(ctx, w, h) {
    const data = this.data.repairStatusData
    const total = this.data.totalRepairs
    const cx = w / 2
    const cy = h / 2
    const outerR = Math.min(w, h) / 2 - 6
    const innerR = outerR * 0.55

    ctx.clearRect(0, 0, w, h)

    // 逐段绘制弧形（起始角度 -90°，从顶部顺时针）
    let startAngle = -Math.PI / 2
    data.forEach(item => {
      const sweep = (item.value / total) * 2 * Math.PI
      if (sweep <= 0) return

      // 绘制环形段
      ctx.beginPath()
      ctx.arc(cx, cy, outerR, startAngle, startAngle + sweep)
      ctx.arc(cx, cy, innerR, startAngle + sweep, startAngle, true)
      ctx.closePath()
      ctx.fillStyle = item.color
      ctx.fill()

      // 段间留 1px 白缝
      ctx.beginPath()
      ctx.arc(cx, cy, outerR, startAngle + sweep, startAngle + sweep + 0.008)
      ctx.arc(cx, cy, innerR, startAngle + sweep + 0.008, startAngle + sweep, true)
      ctx.closePath()
      ctx.fillStyle = '#ffffff'
      ctx.fill()

      startAngle += sweep
    })

    // 中心文字
    ctx.fillStyle = '#1e293b'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(total), cx, cy - 6)

    ctx.font = '11px sans-serif'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText('工单总数', cx, cy + 16)
  },

  /* ================================================================
     折线图（Line Chart）— Canvas 2D
     ================================================================ */
  initLineChart() {
    const query = wx.createSelectorQuery()
    query.select('#lineCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          console.warn('lineCanvas not found')
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio || 2
        const w = res[0].width
        const h = res[0].height

        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)

        this._drawLine(ctx, w, h)
        this.setData({ lineReady: true })
      })
  },

  _drawLine(ctx, w, h) {
    const data = this.data.trendData
    const labels = this.data.trendLabels
    const maxVal = Math.max(...data, 1)

    const pad = { t: 24, r: 20, b: 36, l: 36 }
    const cw = w - pad.l - pad.r
    const ch = h - pad.t - pad.b

    ctx.clearRect(0, 0, w, h)

    // ── Y 轴参考线 ──
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

      // Y 轴刻度值
      const val = Math.round(maxVal - (maxVal / ySteps) * i)
      ctx.fillStyle = '#94a3b8'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(val), pad.l - 8, y)
    }

    // ── 数据点坐标 ──
    const points = data.map((v, i) => ({
      x: pad.l + (i / (data.length - 1)) * cw,
      y: pad.t + ch - (v / maxVal) * ch,
      value: v,
    }))

    // ── 面积渐变 ──
    const gradient = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch)
    gradient.addColorStop(0, 'rgba(18,150,219,0.18)')
    gradient.addColorStop(0.6, 'rgba(18,150,219,0.04)')
    gradient.addColorStop(1, 'rgba(18,150,219,0.00)')

    ctx.beginPath()
    ctx.moveTo(points[0].x, pad.t + ch)
    for (let i = 0; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.lineTo(points[points.length - 1].x, pad.t + ch)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // ── 平滑折线（贝塞尔曲线） ──
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

    // ── 数据点圆点 ──
    points.forEach(p => {
      // 外白圈
      ctx.beginPath()
      ctx.arc(p.x, p.y, 7, 0, 2 * Math.PI)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      // 内蓝圈
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4.5, 0, 2 * Math.PI)
      ctx.fillStyle = '#1296db'
      ctx.fill()
    })

    // ── X 轴标签 ──
    ctx.fillStyle = '#64748b'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    points.forEach((p, i) => {
      ctx.fillText(labels[i], p.x, pad.t + ch + 10)
    })

    // ── 数据点上方数值 ──
    ctx.fillStyle = '#1e293b'
    ctx.font = 'bold 10px sans-serif'
    ctx.textBaseline = 'bottom'
    points.forEach(p => {
      ctx.fillText(String(p.value), p.x, p.y - 10)
    })
  },
})
