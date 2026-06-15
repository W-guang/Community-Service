/**
 * 报修维修模块 - 工单CRUD、状态流转、评论评价、超时预警
 */
const { db, COL, now, ok, getOrCreateUser, requireBoundHouse } = require('./common')

async function actionRepairCreate({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  // 超时预警：2小时后未受理则预警
  const TIMEOUT_HOURS = 2
  const doc = {
    openid,
    roleSnapshot: user.role,
    category: data.category || '其他',
    title: (data.title || '').slice(0, 50),
    content: (data.content || '').slice(0, 500),
    images: Array.isArray(data.images) ? data.images.slice(0, 6) : [],
    location: data.location || null,
    status: 'pending',
    assigneeOpenid: '',
    assigneeName: '',
    timeout_at: now() + TIMEOUT_HOURS * 3600 * 1000,
    accepted_at: null,
    createdAt: now(),
    updatedAt: now(),
  }
  const res = await db.collection(COL.repairs).add({ data: doc })
  return ok({ _id: res._id })
}

async function actionRepairList({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  const pageSize = Math.min(Number(data.pageSize || 20), 50)
  const skip = Math.max(Number(data.skip || 0), 0)
  const where = {}
  if (user.role === 'resident') where.openid = openid
  const q = db.collection(COL.repairs).where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize)
  const res = await q.get()
  return ok({ items: res.data })
}

async function actionRepairDetail({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  const r = await db.collection(COL.repairs).doc(data._id).get()
  const repair = r.data
  if (user.role === 'resident' && repair.openid !== openid) throw new Error('无权限查看该报修单')
  const comments = await db.collection(COL.repairComments)
    .where({ repairId: data._id }).orderBy('createdAt', 'asc').get()
  return ok({ repair, comments: comments.data })
}

const REPAIR_TRANSITIONS = {
  pending: ['processing'],
  processing: ['waiting_confirm', 'done'],
  waiting_confirm: ['done'],
  done: [],
}

async function actionRepairUpdateStatus({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  const r = await db.collection(COL.repairs).doc(data._id).get()
  const repair = r.data
  const current = repair.status
  const next = data.status

  // 验证状态转换合法性
  const allowed = REPAIR_TRANSITIONS[current]
  if (!allowed || !allowed.includes(next)) {
    throw new Error(`非法状态转换：${current} → ${next}`)
  }

  if (user.role === 'resident') {
    if (repair.openid !== openid) throw new Error('无权限')
    // 居民只能从pending→processing（催单），或从waiting_confirm→done（确认完成）
  } else {
    // staff/admin: processing→waiting_confirm 或 processing→done
  }

  const patch = { status: next, updatedAt: now() }
  if (user.role !== 'resident' && next === 'processing') {
    patch.assigneeOpenid = openid
    patch.assigneeName = user.nickname || '处理人员'
    patch.accepted_at = now()
  }
  await db.collection(COL.repairs).doc(data._id).update({ data: patch })
  return ok({ _id: data._id })
}

async function actionRepairComment({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  const r = await db.collection(COL.repairs).doc(data.repairId).get()
  const repair = r.data
  if (user.role === 'resident' && repair.openid !== openid) throw new Error('无权限')
  const content = (data.content || '').slice(0, 300)
  if (!content) throw new Error('内容不能为空')
  await db.collection(COL.repairComments).add({
    data: {
      repairId: data.repairId, fromOpenid: openid, fromRole: user.role,
      fromName: user.nickname || (user.role === 'resident' ? '居民' : '工作人员'),
      content, createdAt: now(),
    },
  })
  // 居民评分：存入独立的 repair_ratings 集合
  if (user.role === 'resident' && typeof data.rating === 'number') {
    const score = Math.max(1, Math.min(5, Math.round(data.rating)))
    await db.collection(COL.repairs).doc(data.repairId).update({
      data: { rating: score, updatedAt: now() },
    })
  }
  return ok({ repairId: data.repairId })
}

module.exports = {
  actionRepairCreate, actionRepairList, actionRepairDetail,
  actionRepairUpdateStatus, actionRepairComment,
}
