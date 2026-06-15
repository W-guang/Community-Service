/**
 * 一键求助（SOS）模块
 */
const { db, COL, now, ok, getOrCreateUser, requireRole } = require('./common')

async function actionSosCreate({ openid, data }) {
  const user = await getOrCreateUser(openid)
  const doc = {
    openid,
    fromName: user.nickname || '求助人',
    phone: user.phone || '',
    location: data.location || null,
    note: (data.note || '').slice(0, 200),
    presetInfo: (data.presetInfo || '').slice(0, 200),
    status: 'pending',
    handlerOpenid: '',
    createdAt: now(),
    updatedAt: now(),
  }
  const res = await db.collection(COL.sos).add({ data: doc })
  return ok({ _id: res._id })
}

async function actionSosList({ openid, data }) {
  const user = await getOrCreateUser(openid)
  const pageSize = Math.min(Number(data.pageSize || 20), 50)
  const skip = Math.max(Number(data.skip || 0), 0)
  const where = {}
  if (user.role === 'resident') where.openid = openid
  if (data.status) where.status = data.status
  const res = await db.collection(COL.sos).where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get()
  return ok({ items: res.data })
}

async function actionSosUpdateStatus({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])
  const next = data.status
  if (!['pending', 'processing', 'done'].includes(next)) throw new Error('非法状态')
  const patch = { status: next, updatedAt: now() }
  if (next === 'processing') patch.handlerOpenid = openid
  await db.collection(COL.sos).doc(data._id).update({ data: patch })
  return ok({ _id: data._id })
}

module.exports = { actionSosCreate, actionSosList, actionSosUpdateStatus }
