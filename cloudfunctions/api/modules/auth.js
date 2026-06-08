/**
 * 认证与用户管理模块
 */
const { db, COL, now, ok, fail, getOrCreateUser, getBindings, requireRole } = require('./common')

async function actionAuth({ openid }) {
  const user = await getOrCreateUser(openid)
  const bindings = await getBindings(openid)
  return ok({ user, bindings })
}

async function actionUserUpdate({ openid, data }) {
  const user = await getOrCreateUser(openid)
  const ALLOWED_KEYS = ['nickname', 'avatarUrl', 'phone', 'elderMode']
  const patch = {}
  ALLOWED_KEYS.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(data, k)) patch[k] = data[k]
  })
  patch.updatedAt = now()
  await db.collection(COL.users).doc(user._id).update({ data: patch })
  const updated = await db.collection(COL.users).doc(user._id).get()
  const bindings = await getBindings(openid)
  return ok({ user: updated.data, bindings })
}

async function actionAdminUserSetRole({ openid, data }) {
  const me = await getOrCreateUser(openid)
  requireRole(me, ['admin'])

  const targetOpenid = (data.openid || '').trim()
  const role = data.role
  const managedCommunities = Array.isArray(data.managedCommunities)
    ? data.managedCommunities.map((s) => String(s).trim()).filter(Boolean)
    : []
  if (!targetOpenid) throw new Error('缺少目标 openid')
  if (!['resident', 'staff', 'admin'].includes(role)) throw new Error('非法角色')

  const targetRes = await db.collection(COL.users).where({ openid: targetOpenid }).limit(1).get()
  if (!targetRes.data || !targetRes.data[0]) throw new Error('目标用户不存在（需先登录一次生成 users 记录）')
  const target = targetRes.data[0]

  const patch = { role, updatedAt: now() }
  if (role === 'staff') patch.managedCommunities = managedCommunities
  if (role !== 'staff') patch.managedCommunities = []

  await db.collection(COL.users).doc(target._id).update({ data: patch })
  return ok({ openid: targetOpenid, role, managedCommunities: patch.managedCommunities })
}

async function actionAdminAdd({ openid, data }) {
  const me = await getOrCreateUser(openid)
  requireRole(me, ['admin'])
  const targetOpenid = (data.openid || '').trim()
  if (!targetOpenid) throw new Error('缺少 openid')
  const existing = await db.collection(COL.adminConfigs)
    .where({ openid: targetOpenid, role: 'admin' }).limit(1).get()
  if (existing.data && existing.data[0]) return ok({ message: '已是管理员' })
  await db.collection(COL.adminConfigs).add({
    data: { openid: targetOpenid, role: 'admin', addedBy: openid, createdAt: now() },
  })
  return ok({ openid: targetOpenid })
}

async function actionAdminRemove({ openid, data }) {
  const me = await getOrCreateUser(openid)
  requireRole(me, ['admin'])
  const targetOpenid = (data.openid || '').trim()
  if (!targetOpenid) throw new Error('缺少 openid')
  const existing = await db.collection(COL.adminConfigs)
    .where({ openid: targetOpenid, role: 'admin' }).limit(1).get()
  if (!existing.data || !existing.data[0]) return ok({ message: '不是管理员' })
  await db.collection(COL.adminConfigs).doc(existing.data[0]._id).remove()
  return ok({ openid: targetOpenid })
}

async function actionAdminUserList({ openid, data }) {
  const me = await getOrCreateUser(openid)
  requireRole(me, ['admin'])
  const pageSize = Math.min(Number(data.pageSize || 30), 100)
  const skip = Math.max(Number(data.skip || 0), 0)
  const where = {}
  if (data.role) where.role = data.role
  if (data.keyword) {
    const kw = data.keyword.trim()
    where.openid = db.RegExp({ regexp: kw, options: 'i' })
  }
  const [res, countRes] = await Promise.all([
    db.collection(COL.users).where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get(),
    db.collection(COL.users).where(where).count(),
  ])
  return ok({ items: res.data || [], total: countRes.total })
}

// 查看用户详情（含房屋绑定关系）
async function actionAdminUserDetail({ openid, data }) {
  const me = await getOrCreateUser(openid)
  requireRole(me, ['staff', 'admin'])
  const targetOpenid = (data.openid || '').trim()
  if (!targetOpenid) throw new Error('缺少 openid')
  const userRes = await db.collection(COL.users).where({ openid: targetOpenid }).limit(1).get()
  if (!userRes.data || !userRes.data[0]) throw new Error('用户不存在')
  const user = userRes.data[0]
  const housesRes = await db.collection(COL.userHouses).where({ openid: targetOpenid }).orderBy('bind_time', 'desc').limit(50).get()
  const houses = housesRes.data || []
  return ok({ user, houses, boundCount: houses.filter(h => h.status === 'bound').length })
}

// 用户管理列表中获取用户-房屋对应关系
async function actionAdminUserHouseMap({ openid, data }) {
  const me = await getOrCreateUser(openid)
  requireRole(me, ['staff', 'admin'])
  const pageSize = Math.min(Number(data.pageSize || 30), 100)
  const skip = Math.max(Number(data.skip || 0), 0)
  const where = {}
  if (data.role) where.role = data.role
  if (data.keyword) {
    const kw = data.keyword.trim()
    where.openid = db.RegExp({ regexp: kw, options: 'i' })
  }
  const [userRes, countRes] = await Promise.all([
    db.collection(COL.users).where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get(),
    db.collection(COL.users).where(where).count(),
  ])
  const users = userRes.data || []
  // 批量获取所有用户的房屋绑定
  const openids = users.map(u => u.openid)
  const houseMap = {}
  if (openids.length) {
    const allHouses = await db.collection(COL.userHouses).where({ openid: _.in(openids) }).orderBy('bind_time', 'desc').get()
    for (const h of (allHouses.data || [])) {
      if (!houseMap[h.openid]) houseMap[h.openid] = []
      houseMap[h.openid].push(h)
    }
  }
  return ok({ items: users.map(u => ({ ...u, houses: houseMap[u.openid] || [] })), total: countRes.total })
}

module.exports = {
  actionAuth,
  actionUserUpdate,
  actionAdminUserSetRole,
  actionAdminAdd,
  actionAdminRemove,
  actionAdminUserList,
  actionAdminUserDetail,
  actionAdminUserHouseMap,
}
