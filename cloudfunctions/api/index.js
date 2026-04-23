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
  // 超级管理员：固定账号（用 openid 白名单控制，不对外开放注册）
  // 你需要把管理员微信号登录后得到的 openid 填到这里
  const ADMIN_OPENIDS = ['o29xy3Rln6lXvj3Y60m-EJhQ4SVY']
  const user = {
    openid,
    role: ADMIN_OPENIDS.includes(openid) ? 'admin' : 'resident', // resident | staff | admin
    nickname: '',
    avatarUrl: '',
    phone: '',
    elderMode: false,
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
    return {
      boundCount: bound.length,
      houses,
    }
  } catch (e) {
    // 首次运行时集合可能尚未创建：视为未绑定
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
    // 集合不存在 => 视为未绑定
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

async function actionAuth({ openid }) {
  const user = await getOrCreateUser(openid)
  const bindings = await getBindings(openid)
  return ok({ user, bindings })
}

async function actionUserUpdate({ openid, data }) {
  const user = await getOrCreateUser(openid)
  const patch = {}
  ;['nickname', 'avatarUrl', 'phone', 'elderMode'].forEach((k) => {
    if (k in data) patch[k] = data[k]
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
  const managedCommunities = Array.isArray(data.managedCommunities) ? data.managedCommunities.map((s) => String(s).trim()).filter(Boolean) : []
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

async function actionHouseBind({ openid, data }) {
  const user = await getOrCreateUser(openid)
  const community = (data.community || '').trim()
  const building = (data.building || '').trim()
  const unit = (data.unit || '').trim()
  const room = (data.room || '').trim()
  const name = (data.name || '').trim()
  const phone = (data.phone || '').trim()
  if (!community || !building || !unit || !room || !name) throw new Error('请完整填写房屋信息（手机号可选）')

  const houseRes = await db
    .collection(COL.houses)
    .where({ community, building, unit, room })
    .limit(1)
    .get()

  if (houseRes.data && houseRes.data[0]) {
    const house = houseRes.data[0]
    // 防重复绑定
    const existed = await db
      .collection(COL.userHouses)
      .where({ openid, house_id: house._id, status: 'bound' })
      .limit(1)
      .get()
    if (existed.data && existed.data[0]) return ok({ status: 'bound', message: '已绑定过该房屋' })

    await db.collection(COL.userHouses).add({
      data: {
        openid,
        house_id: house._id,
        community,
        building,
        unit,
        room,
        name,
        phone,
        bind_time: now(),
        status: 'bound', // bound | pending_verify | rejected
        createdAt: now(),
      },
    })
    const bindings = await getBindings(openid)
    return ok({ status: 'bound', bindings })
  }

  // houses 不存在：写入待核验请求（管理员线下核实后在后台通过）
  await db.collection(COL.userHouses).add({
    data: {
      openid,
      house_id: '',
      community,
      building,
      unit,
      room,
      name,
      phone,
      bind_time: now(),
      status: 'pending_verify',
      createdAt: now(),
    },
  })
  const bindings = await getBindings(openid)
  return ok({
    status: 'pending_verify',
    message: '房屋不存在或未录入，已提交管理员核验',
    bindings,
  })
}

async function actionHouseMyList({ openid }) {
  await getOrCreateUser(openid)
  const bindings = await getBindings(openid)
  return ok(bindings)
}

async function actionHousePendingList({ openid }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])
  let where = { status: 'pending_verify' }
  if (user.role === 'staff') {
    const mc = Array.isArray(user.managedCommunities) ? user.managedCommunities : []
    if (mc.length) where = { ...where, community: _.in(mc) }
    else where = { ...where, community: '__NONE__' }
  }
  const res = await db.collection(COL.userHouses).where(where).orderBy('bind_time', 'desc').limit(50).get()
  return ok({ items: res.data || [] })
}

async function actionHouseApprove({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])
  const reqId = data._id
  const req = await db.collection(COL.userHouses).doc(reqId).get()
  const r = req.data
  if (!r || r.status !== 'pending_verify') throw new Error('记录不存在或状态不可审核')

  const { community, building, unit, room } = r
  const houseRes = await db.collection(COL.houses).where({ community, building, unit, room }).limit(1).get()
  let houseId = houseRes.data && houseRes.data[0] ? houseRes.data[0]._id : ''
  if (!houseId) {
    const addHouse = await db.collection(COL.houses).add({
      data: {
        community,
        building,
        unit,
        room,
        createdAt: now(),
        createdBy: openid,
      },
    })
    houseId = addHouse._id
  }

  await db.collection(COL.userHouses).doc(reqId).update({
    data: {
      house_id: houseId,
      status: 'bound',
      approvedAt: now(),
      approvedBy: openid,
    },
  })
  return ok({ _id: reqId })
}

async function actionHouseReject({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])
  await db.collection(COL.userHouses).doc(data._id).update({
    data: { status: 'rejected', rejectedAt: now(), rejectedBy: openid, rejectReason: (data.reason || '').slice(0, 100) },
  })
  return ok({ _id: data._id })
}

async function actionRepairCreate({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  const doc = {
    openid,
    roleSnapshot: user.role,
    category: data.category || '其他',
    title: (data.title || '').slice(0, 50),
    content: (data.content || '').slice(0, 500),
    images: Array.isArray(data.images) ? data.images.slice(0, 6) : [],
    location: data.location || null, // {name, latitude, longitude, address}
    status: 'pending', // pending -> processing -> waiting_confirm -> done
    assigneeOpenid: '',
    assigneeName: '',
    createdAt: now(),
    updatedAt: now(),
    rating: null,
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
  const comments = await db
    .collection(COL.repairComments)
    .where({ repairId: data._id })
    .orderBy('createdAt', 'asc')
    .get()
  return ok({ repair, comments: comments.data })
}

async function actionRepairUpdateStatus({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  const r = await db.collection(COL.repairs).doc(data._id).get()
  const repair = r.data
  const next = data.status

  const allowed = ['pending', 'processing', 'waiting_confirm', 'done']
  if (!allowed.includes(next)) throw new Error('非法状态')

  if (user.role === 'resident') {
    if (repair.openid !== openid) throw new Error('无权限')
    if (next === 'done') throw new Error('居民不能直接完成工单')
    if (next === 'waiting_confirm') throw new Error('居民不能发起待确认')
  } else {
    // staff/admin
    // 允许接单时写入处理人
  }

  const patch = { status: next, updatedAt: now() }
  if (user.role !== 'resident' && next === 'processing') {
    patch.assigneeOpenid = openid
    patch.assigneeName = user.nickname || '处理人员'
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
      repairId: data.repairId,
      fromOpenid: openid,
      fromRole: user.role,
      fromName: user.nickname || (user.role === 'resident' ? '居民' : '工作人员'),
      content,
      createdAt: now(),
    },
  })
  if (user.role === 'resident' && typeof data.rating === 'number') {
    await db.collection(COL.repairs).doc(data.repairId).update({
      data: { rating: Math.max(1, Math.min(5, data.rating)), updatedAt: now() },
    })
  }
  return ok({ repairId: data.repairId })
}

async function actionHelpCreate({ openid, data }) {
  await requireBoundHouse(openid)
  await getOrCreateUser(openid)
  const doc = {
    openid,
    title: (data.title || '').slice(0, 50),
    content: (data.content || '').slice(0, 500),
    type: data.type || '其他',
    rewardPoints: Math.max(0, Math.min(Number(data.rewardPoints || 0), 999)),
    status: 'open', // open -> taken -> waiting_confirm -> done
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
  if (user.role === 'resident' && !data.mine && !data.takenByMe) {
    // resident 默认只看公开大厅
  }
  const res = await db.collection(COL.helps).where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get()
  return ok({ items: res.data })
}

async function actionHelpDetail({ openid, data }) {
  const user = await getOrCreateUser(openid)
  await requireBoundHouse(openid)
  const h = await db.collection(COL.helps).doc(data._id).get()
  const help = h.data
  if (user.role === 'resident' && help.openid !== openid && help.takerOpenid !== openid) {
    // 允许查看详情（为大厅）但不展示敏感信息；此处暂不含敏感字段
  }
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
    data: {
      status: 'taken',
      takerOpenid: openid,
      takerName: user.nickname || '接单人',
      updatedAt: now(),
    },
  })
  await db.collection(COL.helpProgress).add({
    data: {
      helpId: data._id,
      fromOpenid: openid,
      content: '已接单',
      createdAt: now(),
    },
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
    data: {
      helpId: data._id,
      fromOpenid: openid,
      content: `状态更新：${next}`,
      createdAt: now(),
    },
  })
  return ok({ _id: data._id })
}

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
  const res = await db.collection(COL.notices).orderBy('pinned', 'desc').orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get()
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

async function actionSosCreate({ openid, data }) {
  const user = await getOrCreateUser(openid)
  const doc = {
    openid,
    fromName: user.nickname || '求助人',
    phone: user.phone || '',
    location: data.location || null,
    note: (data.note || '').slice(0, 200),
    status: 'pending', // pending -> processing -> done
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

async function actionDashboardStats({ openid }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])

  const [repairsTotal, repairsPending, repairsDone, helpsTotal, helpsOpen, helpsDone, noticesTotal, sosPending] =
    await Promise.all([
      db.collection(COL.repairs).count(),
      db.collection(COL.repairs).where({ status: 'pending' }).count(),
      db.collection(COL.repairs).where({ status: 'done' }).count(),
      db.collection(COL.helps).count(),
      db.collection(COL.helps).where({ status: 'open' }).count(),
      db.collection(COL.helps).where({ status: 'done' }).count(),
      db.collection(COL.notices).count(),
      db.collection(COL.sos).where({ status: 'pending' }).count(),
    ])

  return ok({
    repairs: { total: repairsTotal.total, pending: repairsPending.total, done: repairsDone.total },
    helps: { total: helpsTotal.total, open: helpsOpen.total, done: helpsDone.total },
    notices: { total: noticesTotal.total },
    sos: { pending: sosPending.total },
    generatedAt: now(),
  })
}

const ROUTES = {
  auth: actionAuth,
  'user.update': actionUserUpdate,
  'admin.userSetRole': actionAdminUserSetRole,

  'house.bind': actionHouseBind,
  'house.myList': actionHouseMyList,
  'house.pendingList': actionHousePendingList,
  'house.approve': actionHouseApprove,
  'house.reject': actionHouseReject,

  'repair.create': actionRepairCreate,
  'repair.list': actionRepairList,
  'repair.detail': actionRepairDetail,
  'repair.updateStatus': actionRepairUpdateStatus,
  'repair.comment': actionRepairComment,

  'help.create': actionHelpCreate,
  'help.list': actionHelpList,
  'help.detail': actionHelpDetail,
  'help.take': actionHelpTake,
  'help.addProgress': actionHelpAddProgress,
  'help.updateStatus': actionHelpUpdateStatus,

  'notice.create': actionNoticeCreate,
  'notice.list': actionNoticeList,
  'notice.detail': actionNoticeDetail,
  'notice.markRead': actionNoticeMarkRead,
  'notice.stats': actionNoticeStats,

  'sos.create': actionSosCreate,
  'sos.list': actionSosList,
  'sos.updateStatus': actionSosUpdateStatus,

  'dashboard.stats': actionDashboardStats,
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const action = event && event.action
    const handler = ROUTES[action]
    if (!handler) return fail(new Error('未知 action'))
    const data = (event && event.data) || {}
    return await handler({ openid: OPENID, data })
  } catch (e) {
    return fail(e)
  }
}

