/**
 * 爱心礼遇兑换模块 - 积分兑换礼品
 */
const { db, COL, now, ok, getOrCreateUser } = require('./common')

/**
 * action: gift.redeem — 使用积分兑换礼品
 * 流程：校验积分 → 扣减积分 → 记录流水 → 记录兑换 → 返回结果
 */
async function actionGiftRedeem({ openid, data }) {
  const user = await getOrCreateUser(openid)
  const { name, points } = data

  if (!name || !points || points <= 0) {
    throw new Error('参数错误')
  }

  // 1. 检查积分是否足够
  const currentPoints = user.totalPoints || 0
  if (currentPoints < points) {
    throw new Error(`积分不足，需要${points}积分（当前${currentPoints}积分）`)
  }

  // 2. 扣减积分
  const newPoints = currentPoints - points
  await db.collection(COL.users).doc(user._id).update({
    data: { totalPoints: newPoints, updatedAt: now() },
  })

  // 3. 记录积分流水
  await db.collection(COL.pointLogs).add({
    data: {
      openid,
      amount: -points,
      type: 'spend',
      source: `兑换礼品：${name}`,
      balance: newPoints,
      createdAt: now(),
    },
  })

  // 4. 记录兑换日志
  await db.collection(COL.giftRedeems).add({
    data: {
      openid,
      giftName: name,
      points,
      status: 'pending',    // pending → fulfilled
      fulfilledAt: null,
      createdAt: now(),
    },
  })

  return ok({
    giftName: name,
    pointsUsed: points,
    pointsAfter: newPoints,
  })
}

/**
 * action: gift.myRedeems — 查询当前用户的兑换记录
 */
async function actionGiftMyRedeems({ openid, data }) {
  const pageSize = Math.min(Number(data.pageSize || 20), 50)
  const skip = Math.max(Number(data.skip || 0), 0)
  const res = await db.collection(COL.giftRedeems)
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()
  return ok({ items: res.data || [] })
}

module.exports = {
  actionGiftRedeem,
  actionGiftMyRedeems,
}
