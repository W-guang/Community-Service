/**
 * 社区公告模块
 */
const { db, COL, now, ok, getOrCreateUser, requireBoundHouse, requireRole } = require('./common')

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
  const res = await db.collection(COL.notices).orderBy('pinned', 'desc').orderBy('createdAt', 'desc')
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

async function actionNoticeStats({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])
  const noticeId = data._id
  const totalUsers = await db.collection(COL.users).count()
  const readCount = await db.collection(COL.noticeReads).where({ noticeId }).count()
  return ok({ noticeId, totalUsers: totalUsers.total, readUsers: readCount.total })
}

module.exports = {
  actionNoticeCreate, actionNoticeList, actionNoticeDetail,
  actionNoticeMarkRead, actionNoticeStats,
}
