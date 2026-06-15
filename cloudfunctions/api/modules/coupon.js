/**
 * 领券中心模块 - 积分兑换优惠券
 */
const { db, COL, now, ok, getOrCreateUser } = require('./common')

/**
 * action: coupon.claim — 使用积分领取优惠券
 */
async function actionCouponClaim({ openid, data }) {
  const user = await getOrCreateUser(openid)
  const { couponId, points, name } = data

  if (!couponId || !points || points <= 0) {
    throw new Error('参数错误')
  }

  // 1. 检查是否已领取
  const existRes = await db.collection(COL.couponRecords)
    .where({ openid, couponId })
    .limit(1)
    .get()
  if (existRes.data && existRes.data[0]) {
    throw new Error('您已领取过该优惠券')
  }

  // 2. 检查积分
  const currentPoints = user.totalPoints || 0
  if (currentPoints < points) {
    throw new Error(`积分不足，需要${points}积分（当前${currentPoints}积分）`)
  }

  // 3. 扣减积分
  const newPoints = currentPoints - points
  await db.collection(COL.users).doc(user._id).update({
    data: { totalPoints: newPoints, updatedAt: now() },
  })

  // 4. 记录积分流水
  await db.collection(COL.pointLogs).add({
    data: {
      openid,
      amount: -points,
      type: 'spend',
      source: `领取优惠券：${name}`,
      balance: newPoints,
      createdAt: now(),
    },
  })

  // 5. 记录领取
  await db.collection(COL.couponRecords).add({
    data: {
      openid,
      couponId,
      couponName: name,
      points,
      status: 'claimed',
      createdAt: now(),
    },
  })

  return ok({
    couponName: name,
    pointsUsed: points,
    pointsAfter: newPoints,
  })
}

/**
 * action: coupon.myClaims — 查询用户已领取的优惠券
 */
async function actionCouponMyClaims({ openid, data }) {
  const pageSize = Math.min(Number(data.pageSize || 20), 50)
  const skip = Math.max(Number(data.skip || 0), 0)
  const res = await db.collection(COL.couponRecords)
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()
  return ok({ items: res.data || [] })
}

module.exports = {
  actionCouponClaim,
  actionCouponMyClaims,
}
