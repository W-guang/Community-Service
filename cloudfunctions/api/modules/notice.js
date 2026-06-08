/**
 * 社区公告模块 - 支持编辑、删除、重要公告已读统计、待办公告
 */
const { db, _, COL, now, ok, getOrCreateUser, requireBoundHouse, requireRole } = require('./common')

async function actionNoticeCreate({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])
  const doc = {
    openid,
    title: (data.title || '').slice(0, 80),
    content: (data.content || '').slice(0, 3000),
    type: data.type || '通知',
    pinned: !!data.pinned,
    important: !!data.important,
    status: 'published',
    createdAt: now(),
    updatedAt: now(),
  }
  const res = await db.collection(COL.notices).add({ data: doc })
  return ok({ _id: res._id })
}

async function actionNoticeList({ openid, data }) {
  await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  const pageSize = Math.min(Number(data.pageSize || 20), 50)
  const skip = Math.max(Number(data.skip || 0), 0)
  // 默认只显示已发布的
  const where = { status: 'published' }
  if (data.type) where.type = data.type
  const res = await db.collection(COL.notices).where(where).orderBy('pinned', 'desc').orderBy('createdAt', 'desc')
    .skip(skip).limit(pageSize).get()
  return ok({ items: res.data })
}

async function actionNoticeDetail({ openid, data }) {
  await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  const n = await db.collection(COL.notices).doc(data._id).get()
  const notice = n.data
  const readRes = await db.collection(COL.noticeReads).where({ noticeId: data._id, openid }).limit(1).get()
  const read = !!(readRes.data && readRes.data[0])
  return ok({ notice, read })
}

async function actionNoticeMarkRead({ openid, data }) {
  await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  const existing = await db.collection(COL.noticeReads).where({ noticeId: data._id, openid }).limit(1).get()
  if (existing.data && existing.data[0]) return ok({ _id: data._id })
  await db.collection(COL.noticeReads).add({ data: { noticeId: data._id, openid, createdAt: now() } })
  return ok({ _id: data._id })
}

// 仅统计重要公告的已读
async function actionNoticeStats({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])
  const noticeId = data._id
  // 只有重要公告才统计已读
  const notice = await db.collection(COL.notices).doc(noticeId).get()
  if (!notice.data || !notice.data.important) {
    return ok({ noticeId, totalUsers: 0, readUsers: 0, isImportant: false })
  }
  const totalUsers = await db.collection(COL.users).count()
  const readCount = await db.collection(COL.noticeReads).where({ noticeId }).count()
  return ok({ noticeId, totalUsers: totalUsers.total, readUsers: readCount.total, isImportant: true })
}

// 用户获取待办公告（重要且未读的公告）
async function actionNoticePending({ openid }) {
  await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  // 获取所有重要公告
  const allImportant = await db.collection(COL.notices)
    .where({ important: true, status: 'published' })
    .orderBy('createdAt', 'desc')
    .limit(100).get()
  const importantIds = (allImportant.data || []).map(n => n._id)
  // 获取用户已读记录
  const readIds = new Set()
  if (importantIds.length) {
    const reads = await db.collection(COL.noticeReads)
      .where({ openid, noticeId: _.in(importantIds) }).get()
    for (const r of (reads.data || [])) readIds.add(r.noticeId)
  }
  // 筛选未读的重要公告
  const pending = (allImportant.data || []).filter(n => !readIds.has(n._id))
  return ok({ items: pending, count: pending.length })
}

// 更新公告
async function actionNoticeUpdate({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])
  const patch = { updatedAt: now() }
  if (data.title !== undefined) patch.title = (data.title || '').slice(0, 80)
  if (data.content !== undefined) patch.content = (data.content || '').slice(0, 3000)
  if (data.type !== undefined) patch.type = data.type
  if (data.pinned !== undefined) patch.pinned = !!data.pinned
  if (data.important !== undefined) patch.important = !!data.important
  if (data.status !== undefined) patch.status = data.status
  await db.collection(COL.notices).doc(data._id).update({ data: patch })
  return ok({ _id: data._id })
}

// 删除公告
async function actionNoticeDelete({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])
  await db.collection(COL.notices).doc(data._id).remove()
  // 同时删除已读记录
  const reads = await db.collection(COL.noticeReads).where({ noticeId: data._id }).get()
  for (const r of (reads.data || [])) {
    await db.collection(COL.noticeReads).doc(r._id).remove()
  }
  return ok({ _id: data._id })
}

// 管理员获取公告列表（含所有状态）
async function actionNoticeListAll({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])
  const pageSize = Math.min(Number(data.pageSize || 50), 100)
  const skip = Math.max(Number(data.skip || 0), 0)
  const res = await db.collection(COL.notices).orderBy('pinned', 'desc').orderBy('createdAt', 'desc')
    .skip(skip).limit(pageSize).get()
  // 为每条公告附加已读统计
  const items = []
  for (const n of (res.data || [])) {
    let readCount = 0, totalUsers = 0
    if (n.important) {
      totalUsers = (await db.collection(COL.users).count()).total
      readCount = (await db.collection(COL.noticeReads).where({ noticeId: n._id }).count()).total
    }
    items.push({ ...n, readCount, totalUsers, readPercent: totalUsers > 0 ? Math.round(readCount / totalUsers * 100) : 0 })
  }
  return ok({ items })
}

module.exports = {
  actionNoticeCreate, actionNoticeList, actionNoticeDetail,
  actionNoticeMarkRead, actionNoticeStats, actionNoticePending,
  actionNoticeUpdate, actionNoticeDelete, actionNoticeListAll,
}
