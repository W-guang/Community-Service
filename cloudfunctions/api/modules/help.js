/**
 * 邻里互助模块 - 任务CRUD、接单、进度、状态流转、积分发放、荣誉分
 */
const { db, _, COL, now, ok, getOrCreateUser, requireBoundHouse, requireRole } = require('./common')

async function actionHelpCreate({ openid, data }) {
  const user = await getOrCreateUser(openid)
  // 管理员/网格员不能发布互助任务
  if (user.role === 'staff' || user.role === 'admin') {
    throw new Error('管理员和网格员不能发布互助任务，请切换至普通模式')
  }
  await requireBoundHouse(openid, user)
  // 计算截止时间：默认7天
  const deadlineDays = Math.max(1, Math.min(30, Number(data.deadlineDays || 7)))
  const deadline = now() + deadlineDays * 86400 * 1000
  const doc = {
    openid,
    title: (data.title || '').slice(0, 50),
    content: (data.content || '').slice(0, 500),
    type: data.type || '其他',
    rewardPoints: Math.max(0, Math.min(Number(data.rewardPoints || 0), 999)),
    originalPoints: Math.max(0, Math.min(Number(data.rewardPoints || 0), 999)),
    status: 'pending_review', // 新增：待审核状态
    takerOpenid: '',
    takerName: '',
    deadline,
    createdAt: now(),
    updatedAt: now(),
  }
  const res = await db.collection(COL.helps).add({ data: doc })
  return ok({ _id: res._id })
}

// 管理员审核互助任务（可调整积分后发布）
async function actionHelpReview({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])
  const h = await db.collection(COL.helps).doc(data._id).get()
  const help = h.data
  if (!help || help.status !== 'pending_review') throw new Error('任务状态不可审核')
  const patch = {
    status: data.approve ? 'open' : 'rejected',
    updatedAt: now(),
  }
  if (data.approve && typeof data.rewardPoints === 'number') {
    patch.rewardPoints = Math.max(0, Math.min(999, Math.round(data.rewardPoints)))
  }
  await db.collection(COL.helps).doc(data._id).update({ data: patch })
  return ok({ _id: data._id, status: patch.status })
}

async function actionHelpList({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid, user)
  const pageSize = Math.min(Number(data.pageSize || 20), 50)
  const skip = Math.max(Number(data.skip || 0), 0)
  const where = {}
  if (data.mine) where.openid = openid
  if (data.takenByMe) where.takerOpenid = openid
  // 管理员查看待审核任务
  if (data.status) where.status = data.status
  // 默认不展示已拒绝和审核中的（除非明确筛选）
  if (!data.status && !data.mine && !data.takenByMe) {
    where.status = _.in(['open', 'taken', 'waiting_confirm', 'done'])
  }
  // 自动清理过期任务
  const expiredTasks = await db.collection(COL.helps)
    .where({ status: _.in(['open', 'pending_review']), deadline: _.lt(now()) }).get()
  for (const t of (expiredTasks.data || [])) {
    await db.collection(COL.helps).doc(t._id).update({ data: { status: 'expired', updatedAt: now() } })
  }
  const res = await db.collection(COL.helps).where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get()
  return ok({ items: res.data })
}

async function actionHelpDetail({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid, user)
  const h = await db.collection(COL.helps).doc(data._id).get()
  const help = h.data
  const progress = await db.collection(COL.helpProgress).where({ helpId: data._id }).orderBy('createdAt', 'asc').get()
  return ok({ help, progress: progress.data })
}

async function actionHelpTake({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid, user)
  // 管理员/网格员不能接单
  if (user.role === 'staff' || user.role === 'admin') {
    throw new Error('管理员和网格员不能承接互助任务，请切换至普通模式')
  }
  const h = await db.collection(COL.helps).doc(data._id).get()
  const help = h.data
  if (help.status !== 'open') throw new Error('任务不可接单')
  if (help.openid === openid) throw new Error('不能接自己的任务')
  if (help.deadline && help.deadline < now()) throw new Error('任务已过期')
  // 获取发布者手机号
  const ownerUser = await db.collection(COL.users).where({ openid: help.openid }).limit(1).get()
  const ownerPhone = (ownerUser.data && ownerUser.data[0]) ? (ownerUser.data[0].phone || '') : ''
  // 获取接单者手机号
  const takerPhone = user.phone || ''
  // 原子更新
  const updateRes = await db.collection(COL.helps)
    .where({ _id: data._id, status: 'open' })
    .update({
      data: {
        status: 'taken', takerOpenid: openid, takerName: user.nickname || '接单人',
        takerPhone, ownerPhone, updatedAt: now(),
      },
    })
  if (!updateRes.stats || updateRes.stats.updated === 0) throw new Error('任务已被他人接单')
  await db.collection(COL.helpProgress).add({
    data: { helpId: data._id, fromOpenid: openid, content: '已接单', createdAt: now() },
  })
  // 返回包含电话号码的详情
  const updated = await db.collection(COL.helps).doc(data._id).get()
  return ok(updated.data)
}

async function actionHelpAddProgress({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid, user)
  const h = await db.collection(COL.helps).doc(data.helpId).get()
  const help = h.data
  if (help.openid !== openid && help.takerOpenid !== openid) throw new Error('无权限')
  const content = (data.content || '').slice(0, 200)
  if (!content) throw new Error('内容不能为空')
  await db.collection(COL.helpProgress).add({
    data: { helpId: data.helpId, fromOpenid: openid, content, createdAt: now() },
  })
  await db.collection(COL.helps).doc(data.helpId).update({ data: { updatedAt: now() } })
  return ok({ helpId: data.helpId })
}

const HELP_TRANSITIONS = {
  pending_review: ['open', 'rejected'],
  open: ['taken'],
  taken: ['waiting_confirm'],
  waiting_confirm: ['done'],
  done: [],
  rejected: [],
  expired: [],
}

async function actionHelpUpdateStatus({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid, user)
  const h = await db.collection(COL.helps).doc(data._id).get()
  const help = h.data
  const current = help.status
  const next = data.status

  // 验证状态转换合法性
  const allowed = HELP_TRANSITIONS[current]
  if (!allowed || !allowed.includes(next)) {
    throw new Error(`非法状态转换：${current} → ${next}`)
  }

  const isOwner = help.openid === openid
  const isTaker = help.takerOpenid === openid
  if (!isOwner && !isTaker) throw new Error('无权限')
  if (next === 'waiting_confirm' && !isTaker) throw new Error('仅接单方可发起待确认')
  if (next === 'done' && !isOwner) throw new Error('仅发布方可确认完成')

  await db.collection(COL.helps).doc(data._id).update({ data: { status: next, updatedAt: now() } })
  await db.collection(COL.helpProgress).add({
    data: { helpId: data._id, fromOpenid: openid, content: `状态更新：${next}`, createdAt: now() },
  })

  // 任务完成时发放积分给接单者（仅从waiting_confirm→done时触发）
  if (next === 'done' && help.takerOpenid) {
    // 幂等保护：检查是否已发放过积分流水
    const alreadyRewarded = await db.collection(COL.pointLogs)
      .where({ openid: help.takerOpenid, source: `完成互助任务#${data._id}` }).limit(1).get()
    if (!alreadyRewarded.data || !alreadyRewarded.data[0]) {
      const points = help.rewardPoints || 0
      if (points > 0) {
        const takerUser = await db.collection(COL.users).where({ openid: help.takerOpenid }).limit(1).get()
        if (takerUser.data && takerUser.data[0]) {
          const tu = takerUser.data[0]
          const newTotal = (tu.totalPoints || 0) + points
          await db.collection(COL.users).doc(tu._id).update({
            data: { totalPoints: newTotal, updatedAt: now() },
          })
          await db.collection(COL.pointLogs).add({
            data: { openid: help.takerOpenid, amount: points, type: 'earn',
              source: `完成互助任务#${data._id}`, balance: newTotal, createdAt: now() },
          })
        }
      }
      // 双方信誉分+1
      for (const uid of [help.openid, help.takerOpenid]) {
        const u = await db.collection(COL.users).where({ openid: uid }).limit(1).get()
        if (u.data && u.data[0]) {
          const newCredit = (u.data[0].creditScore || 100) + 1
          await db.collection(COL.users).doc(u.data[0]._id).update({
            data: { creditScore: newCredit, updatedAt: now() },
          })
          await db.collection(COL.creditLogs).add({
            data: { openid: uid, change: 1, reason: `互助任务完成#${data._id}`, balance: newCredit, createdAt: now() },
          })
        }
      }
    }
  }

  return ok({ _id: data._id })
}

async function actionHelpRate({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid, user)
  const helpId = data.helpId
  const h = await db.collection(COL.helps).doc(helpId).get()
  const help = h.data
  if (help.status !== 'done') throw new Error('任务未完成，暂不能评价')
  if (openid !== help.openid && openid !== help.takerOpenid) throw new Error('无权限评价')
  const targetOpenid = openid === help.openid ? help.takerOpenid : help.openid
  if (!targetOpenid) throw new Error('评价目标不存在')

  const existing = await db.collection(COL.helpRatings)
    .where({ helpId, fromOpenid: openid, toOpenid: targetOpenid }).limit(1).get()
  if (existing.data && existing.data[0]) throw new Error('您已评价过该任务')

  const score = Math.max(1, Math.min(5, Math.round(Number(data.score || 3))))
  const comment = (data.comment || '').slice(0, 200)

  await db.collection(COL.helpRatings).add({
    data: { helpId, fromOpenid: openid, toOpenid: targetOpenid, score, comment, createdAt: now() },
  })

  // 计算荣誉分增量：积分 × 评分 ÷ 5
  const points = help.rewardPoints || 0
  const honorGain = Math.round(points * score / 5)

  // 更新被评价者的荣誉分
  const targetUser = await db.collection(COL.users).where({ openid: targetOpenid }).limit(1).get()
  if (targetUser.data && targetUser.data[0]) {
    const tu = targetUser.data[0]
    const newHonor = (tu.honorPoints || 0) + honorGain
    await db.collection(COL.users).doc(tu._id).update({ data: { honorPoints: newHonor, updatedAt: now() } })

    // 记录荣誉分流水
    if (honorGain > 0) {
      try {
        await db.collection(COL.honorPoints).add({
          data: {
            openid: targetOpenid, amount: honorGain, helpId,
            rewardPoints: points, score,
            createdAt: now(),
          },
        })
      } catch (_) { /* 集合可能不存在，不影响主流程 */ }
    }

    // 更新信誉分
    const allRatings = await db.collection(COL.helpRatings).where({ toOpenid: targetOpenid }).get()
    const avgScore = allRatings.data.reduce((s, r) => s + r.score, 0) / Math.max(1, allRatings.data.length)
    const newCredit = Math.round(avgScore * 20 + (allRatings.data.length > 5 ? 5 : 0))
    const clamped = Math.max(0, Math.min(200, newCredit))
    const change = clamped - (tu.creditScore || 100)
    await db.collection(COL.users).doc(tu._id).update({ data: { creditScore: clamped, updatedAt: now() } })
    if (change !== 0) {
      await db.collection(COL.creditLogs).add({
        data: { openid: targetOpenid, change, reason: `互助评价更新#${helpId}`, balance: clamped, createdAt: now() },
      })
    }
  }

  return ok({ helpId, honorGain })
}

// 互助荣誉榜
async function actionHelpLeaderboard({ openid, data }) {
  await getOrCreateUser(openid)
  await requireBoundHouse(openid, user)
  const pageSize = Math.min(Number(data.pageSize || 50), 100)
  const res = await db.collection(COL.users)
    .where({ honorPoints: _.gt(0) })
    .orderBy('honorPoints', 'desc')
    .limit(pageSize)
    .get()
  const items = (res.data || []).map((u, i) => ({
    rank: i + 1,
    openid: u.openid,
    nickname: u.nickname || '匿名用户',
    avatarUrl: u.avatarUrl || '',
    honorPoints: u.honorPoints || 0,
    creditScore: u.creditScore || 100,
  }))
  return ok({ items })
}

module.exports = {
  actionHelpCreate, actionHelpList, actionHelpDetail, actionHelpTake,
  actionHelpAddProgress, actionHelpUpdateStatus, actionHelpRate,
  actionHelpReview, actionHelpLeaderboard,
}
