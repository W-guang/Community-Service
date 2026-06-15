/**
 * 积分转盘模块 - 服务端抽奖、积分扣减、次数管理、中奖记录
 */
const { db, COL, now, ok, getOrCreateUser } = require('./common')

// 服务端权重配置（前端视觉等大，但概率暗中分配）
// 总权重 1000，谢谢惠顾占 842(≈84%)，中奖总概率约 16%
// 5元抵扣券 5% | 一袋口罩 3.5% | 食盐1袋 2.5% | 抽纸套装 1.8%
// 洗衣液3kg 1.2% | 蒸汽眼罩 0.8% | 大米5kg 0.6% | 5L花生油 0.4%
const WHEEL_ITEMS = [
  { name: '5L花生油',   w: 4,   color: '#ff3b3b' },
  { name: '谢谢惠顾',   w: 105, color: '#ffffff' },
  { name: '大米5kg',     w: 6,   color: '#ffd700' },
  { name: '谢谢惠顾',   w: 105, color: '#ffffff' },
  { name: '蒸汽眼罩',   w: 8,   color: '#3bff6f' },
  { name: '谢谢惠顾',   w: 106, color: '#ffffff' },
  { name: '洗衣液3kg',  w: 12,  color: '#3b9fff' },
  { name: '谢谢惠顾',   w: 105, color: '#ffffff' },
  { name: '抽纸套装',   w: 18,  color: '#ff3b3b' },
  { name: '谢谢惠顾',   w: 106, color: '#ffffff' },
  { name: '食盐1袋',    w: 25,  color: '#ffd700' },
  { name: '谢谢惠顾',   w: 105, color: '#ffffff' },
  { name: '一袋口罩',    w: 35,  color: '#3bff6f' },
  { name: '谢谢惠顾',   w: 105, color: '#ffffff' },
  { name: '5元抵扣券',   w: 50,  color: '#3b9fff' },
  { name: '谢谢惠顾',   w: 105, color: '#ffffff' },
]
const TOTAL_W = WHEEL_ITEMS.reduce((s, p) => s + p.w, 0)

// 每次抽奖消耗积分（测试期间设为0，上线后改回10）
const SPIN_COST = 0
// 每日免费次数上限（测试期间设大，上线后改回3）
const DAILY_FREE_LIMIT = 999

/**
 * 服务端加权随机选取扇区，返回扇区索引和奖品信息
 */
function weightedRandomSelect() {
  const rand = Math.random() * TOTAL_W
  let cumulative = 0
  for (let i = 0; i < WHEEL_ITEMS.length; i++) {
    cumulative += WHEEL_ITEMS[i].w
    if (rand < cumulative) return { index: i, prize: WHEEL_ITEMS[i] }
  }
  // 兜底：返回最后一个
  const last = WHEEL_ITEMS.length - 1
  return { index: last, prize: WHEEL_ITEMS[last] }
}

/**
 * 获取今日开始时间戳 (当天 00:00:00)
 */
function todayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * 查询用户今日已抽次数
 */
async function getTodaySpinCount(openid) {
  const ts = todayStart()
  const res = await db.collection(COL.lotteryLogs)
    .where({ openid, createdAt: db.command.gte(ts) })
    .count()
  return res.total || 0
}

/**
 * action: lottery.spin — 执行一次转盘抽奖
 * 流程：校验次数 → 扣积分 → 服务端随机选奖 → 记录日志 → 返回结果
 */
async function actionLotterySpin({ openid, data }) {
  const user = await getOrCreateUser(openid)

  // 1. 检查今日剩余次数
  const todayCount = await getTodaySpinCount(openid)
  if (todayCount >= DAILY_FREE_LIMIT) {
    throw new Error('今日抽奖次数已用完，明天再来吧')
  }

  // 2. 检查积分是否足够
  const currentPoints = user.totalPoints || 0
  if (currentPoints < SPIN_COST) {
    throw new Error(`积分不足，需要${SPIN_COST}积分（当前${currentPoints}积分）`)
  }

  // 3. 服务端随机选取奖品
  const { index, prize } = weightedRandomSelect()
  const isWin = prize.name !== '谢谢惠顾'

  // 4. 扣减积分
  const newPoints = currentPoints - SPIN_COST
  await db.collection(COL.users).doc(user._id).update({
    data: { totalPoints: newPoints, updatedAt: now() },
  })

  // 5. 记录积分流水
  await db.collection(COL.pointLogs).add({
    data: {
      openid,
      amount: -SPIN_COST,
      type: 'spend',
      source: '积分转盘抽奖',
      balance: newPoints,
      createdAt: now(),
    },
  })

  // 6. 记录抽奖日志
  const logData = {
    openid,
    prizeName: prize.name,
    prizeIndex: index,
    isWin,
    spinCost: SPIN_COST,
    pointsAfter: newPoints,
    createdAt: now(),
  }
  const logRes = await db.collection(COL.lotteryLogs).add({ data: logData })

  // 7. 如果中奖，记录中奖信息（后续可在管理端处理兑换）
  if (isWin) {
    await db.collection(COL.lotteryPrizes).add({
      data: {
        openid,
        logId: logRes._id,
        prizeName: prize.name,
        status: 'pending',    // pending → claimed → fulfilled
        claimedAt: null,
        fulfilledAt: null,
        createdAt: now(),
      },
    })
  }

  return ok({
    prizeIndex: index,
    prizeName: prize.name,
    isWin,
    pointsAfter: newPoints,
    todayRemain: DAILY_FREE_LIMIT - todayCount - 1,
    spinCost: SPIN_COST,
  })
}

/**
 * action: lottery.remain — 查询今日剩余次数和积分
 */
async function actionLotteryRemain({ openid }) {
  const user = await getOrCreateUser(openid)
  const todayCount = await getTodaySpinCount(openid)
  return ok({
    totalPoints: user.totalPoints || 0,
    todayRemain: Math.max(0, DAILY_FREE_LIMIT - todayCount),
    spinCost: SPIN_COST,
    dailyLimit: DAILY_FREE_LIMIT,
  })
}

/**
 * action: lottery.history — 查询抽奖历史记录
 */
async function actionLotteryHistory({ openid, data }) {
  const user = await getOrCreateUser(openid)
  const pageSize = Math.min(Number(data.pageSize || 20), 50)
  const skip = Math.max(Number(data.skip || 0), 0)
  const res = await db.collection(COL.lotteryLogs)
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()
  return ok({ items: res.data || [] })
}

/**
 * action: lottery.prizes — 查询用户中奖列表（待领取/已领取）
 */
async function actionLotteryPrizes({ openid, data }) {
  const user = await getOrCreateUser(openid)
  const where = { openid }
  if (data.status) where.status = data.status
  const res = await db.collection(COL.lotteryPrizes)
    .where(where)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()
  return ok({ items: res.data || [] })
}

module.exports = {
  actionLotterySpin,
  actionLotteryRemain,
  actionLotteryHistory,
  actionLotteryPrizes,
}
