/**
 * 共享工具模块 - 数据库初始化、通用函数、权限守卫
 * 供所有业务模块引用
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const COL = {
  users: 'users',
  houses: 'houses',
  userHouses: 'user_houses',
  repairs: 'repairs',
  repairComments: 'repair_comments',
  helps: 'helps',
  helpProgress: 'help_progress',
  notices: 'notices',
  noticeReads: 'notice_reads',
  sos: 'sos',
  pointLogs: 'point_logs',
  creditLogs: 'credit_logs',
  helpRatings: 'help_ratings',
  adminConfigs: 'admin_configs',
}

const ADMIN_OPENIDS_FALLBACK = ['o29xy3Rln6lXvj3Y60m-EJhQ4SVY']

let cachedAdminOpenids = null
let cacheExpireAt = 0

async function getAdminOpenids() {
  if (cachedAdminOpenids && Date.now() < cacheExpireAt) return cachedAdminOpenids
  try {
    const { data } = await db.collection(COL.adminConfigs).where({ role: 'admin' }).limit(50).get()
    if (data && data.length) {
      cachedAdminOpenids = [...new Set(data.map((d) => d.openid))]
      cacheExpireAt = Date.now() + 300000 // 5分钟缓存
      return cachedAdminOpenids
    }
  } catch (_) { /* 集合可能尚不存在 */ }
  cachedAdminOpenids = ADMIN_OPENIDS_FALLBACK
  cacheExpireAt = Date.now() + 300000
  return cachedAdminOpenids
}

function isAdmin(openid) {
  return ADMIN_OPENIDS_FALLBACK.includes(openid)
}

function now() {
  return Date.now()
}

function ok(data) {
  return { ok: true, data }
}

function fail(error) {
  return { ok: false, error: error && error.message ? error.message : String(error) }
}

async function getOrCreateUser(openid) {
  const existing = await db.collection(COL.users).where({ openid }).limit(1).get()
  if (existing.data && existing.data[0]) return existing.data[0]
  const adminList = await getAdminOpenids()
  const user = {
    openid,
    role: adminList.includes(openid) ? 'admin' : 'resident',
    nickname: '',
    avatarUrl: '',
    phone: '',
    elderMode: false,
    creditScore: 100,
    totalPoints: 0,
    createdAt: now(),
    updatedAt: now(),
  }
  const addRes = await db.collection(COL.users).add({ data: user })
  return { ...user, _id: addRes._id }
}

async function getBindings(openid) {
  try {
    const res = await db.collection(COL.userHouses).where({ openid }).orderBy('bind_time', 'desc').limit(50).get()
    const houses = res.data || []
    const bound = houses.filter((h) => h.status === 'bound')
    return { boundCount: bound.length, houses }
  } catch (e) {
    const msg = (e && e.message) || ''
    if (msg.includes('COLLECTION_NOT_EXIST') || msg.includes('collection') || msg.includes('Db or Table not exist')) {
      return { boundCount: 0, houses: [] }
    }
    throw e
  }
}

async function requireBoundHouse(openid) {
  try {
    const res = await db.collection(COL.userHouses).where({ openid, status: 'bound' }).limit(1).get()
    if (res.data && res.data[0]) return res.data[0]
  } catch (e) {
    const msg = (e && e.message) || ''
    if (!(msg.includes('COLLECTION_NOT_EXIST') || msg.includes('Db or Table not exist'))) throw e
  }
  const err = new Error('请先绑定房屋')
  err.code = 'HOUSE_REQUIRED'
  throw err
}

function requireRole(user, roles) {
  if (!roles.includes(user.role)) {
    const err = new Error('无权限')
    err.code = 'FORBIDDEN'
    throw err
  }
}

module.exports = {
  db, _, COL, now, ok, fail,
  getOrCreateUser, getBindings, requireBoundHouse, requireRole,
  getAdminOpenids, isAdmin,
}
