/**
 * 邻里互助模块 - 任务CRUD、接单、进度、状态流转、积分发放
 */
const { db, COL, now, ok, getOrCreateUser, requireBoundHouse } = require('./common')

async function actionHelpCreate({ openid, data }) {
  await requireBoundHouse(openid)
  await getOrCreateUser(openid)
  const doc = {
    openid,
    title: (data.title || '').slice(0, 50),
    content: (data.content || '').slice(0, 500),
    type: data.type || '其他',
    rewardPoints: Math.max(0, Math.min(Number(data.rewardPoints || 0), 999)),
    status: 'open',
    takerOpenid: '',
    takerName: '',
    createdAt: now(),
    updatedAt: now(),
  }
  const res = await db.collection(COL.helps).add({ data: doc })
  return ok({ _id: res._id })
}

async function actionHelpList({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  const pageSize = Math.min(Number(data.pageSize || 20), 50)
  const skip = Math.max(Number(data.skip || 0), 0)
  const where = {}
  if (data.mine) where.openid = openid
  if (data.takenByMe) where.takerOpenid = openid
  const res = await db.collection(COL.helps).where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get()
  return ok({ items: res.data })
}

async function actionHelpDetail({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  const h = await db.collection(COL.helps).doc(data._id).get()
  const help = h.data
  const progress = await db.collection(COL.helpProgress).where({ helpId: data._id }).orderBy('createdAt', 'asc').get()
  return ok({ help, progress: progress.data })
}

async function actionHelpTake({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  const h = await db.collection(COL.helps).doc(data._id).get()
  const help = h.data
  if (help.status !== 'open') throw new Error('任务不可接单')
  if (help.openid === openid) throw new Error('不能接自己的任务')
  await db.collection(COL.helps).doc(data._id).update({
    data: { status: 'taken', takerOpenid: openid, takerName: user.nickname || '接单人', updatedAt: now() },
  })
  await db.collection(COL.helpProgress).add({
    data: { helpId: data._id, fromOpenid: openid, content: '已接单', createdAt: now() },
  })
  return ok({ _id: data._id })
}

async function actionHelpAddProgress({ openid, data }) {
  await requireBoundHouse(openid)
  await getOrCreateUser(openid)
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

async function actionHelpUpdateStatus({ openid, data }) {
  await requireBoundHouse(openid)
  await getOrCreateUser(openid)
  const h = await db.collection(COL.helps).doc(data._id).get()
  const help = h.data
  const next = data.status
  if (!['open', 'taken', 'waiting_confirm', 'done'].includes(next)) throw new Error('非法状态')
  const isOwner = help.openid === openid
  const isTaker = help.takerOpenid === openid
  if (!isOwner && !isTaker) throw new Error('无权限')
  if (next === 'waiting_confirm' && !isTaker) throw new Error('仅接单方可发起待确认')
  if (next === 'done' && !isOwner) throw new Error('仅发布方可确认完成')

  await db.collection(COL.helps).doc(data._id).update({ data: { status: next, updatedAt: now() } })
  await db.collection(COL.helpProgress).add({
    data: { helpId: data._id, fromOpenid: openid, content: `状态更新：${next}`, createdAt: now() },
  })

  // 任务完成时发放积分给接单者
  if (next === 'done' && help.takerOpenid) {
    const points = help.rewardPoints || 0
    if (points > 0) {
      const takerUser = await db.collection(COL.users).where({ openid: help.takerOpenid }).limit(1).get()
      if (takerUser.data && takerUser.data[0]) {
        const tu = takerUser.data[0]
        const newTotal = (tu.totalPoints || 0) + points
        await db.collection(COL.users).doc(tu._id).update({
          data: { totalPoints: newTotal, updatedAt: now() },
        })
        // 积分流水
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

  return ok({ _id: data._id })
}

async function actionHelpRate({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid)
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

  const score = Math.max(1, Math.min(5, Math.round(Number(data.score || 5))))
  const comment = (data.comment || '').slice(0, 200)

  await db.collection(COL.helpRatings).add({
    data: { helpId, fromOpenid: openid, toOpenid: targetOpenid, score, comment, createdAt: now() },
  })

  // 更新被评价者的信誉分：取所有收到的评分平均值作为信誉分调整参考
  const targetUser = await db.collection(COL.users).where({ openid: targetOpenid }).limit(1).get()
  if (targetUser.data && targetUser.data[0]) {
    const tu = targetUser.data[0]
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

  return ok({ helpId })
}

module.exports = {
  actionHelpCreate, actionHelpList, actionHelpDetail, actionHelpTake,
  actionHelpAddProgress, actionHelpUpdateStatus, actionHelpRate,
}
