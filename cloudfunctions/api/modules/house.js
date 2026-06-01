/**
 * 房屋管理模块 - 绑定、核验、审批
 */
const { db, _, COL, now, ok, getOrCreateUser, getBindings, requireRole } = require('./common')

async function actionHouseBind({ openid, data }) {
  const user = await getOrCreateUser(openid)
  const community = (data.community || '').trim()
  const building = (data.building || '').trim()
  const unit = (data.unit || '').trim()
  const room = (data.room || '').trim()
  const name = (data.name || '').trim()
  const phone = (data.phone || '').trim()
  if (!community || !building || !unit || !room || !name) throw new Error('请完整填写房屋信息（手机号可选）')

  const houseRes = await db.collection(COL.houses)
    .where({ community, building, unit, room }).limit(1).get()

  if (houseRes.data && houseRes.data[0]) {
    const house = houseRes.data[0]
    const existed = await db.collection(COL.userHouses)
      .where({ openid, house_id: house._id, status: 'bound' }).limit(1).get()
    if (existed.data && existed.data[0]) return ok({ status: 'bound', message: '已绑定过该房屋' })

    await db.collection(COL.userHouses).add({
      data: { openid, house_id: house._id, community, building, unit, room, name, phone,
        bind_time: now(), status: 'bound', createdAt: now() },
    })
    const bindings = await getBindings(openid)
    return ok({ status: 'bound', bindings })
  }

  await db.collection(COL.userHouses).add({
    data: { openid, house_id: '', community, building, unit, room, name, phone,
      bind_time: now(), status: 'pending_verify', createdAt: now() },
  })
  const bindings = await getBindings(openid)
  return ok({ status: 'pending_verify', message: '房屋不存在或未录入，已提交管理员核验', bindings })
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

  // staff 管辖范围校验
  if (user.role === 'staff') {
    const mc = Array.isArray(user.managedCommunities) ? user.managedCommunities : []
    if (mc.length && !mc.includes(r.community)) {
      throw new Error('无权审核该小区的房屋绑定')
    }
    if (!mc.length) throw new Error('您未配置管辖小区')
  }

  const { community, building, unit, room } = r
  const houseRes = await db.collection(COL.houses).where({ community, building, unit, room }).limit(1).get()
  let houseId = houseRes.data && houseRes.data[0] ? houseRes.data[0]._id : ''
  if (!houseId) {
    const addHouse = await db.collection(COL.houses).add({
      data: { community, building, unit, room, createdAt: now(), createdBy: openid },
    })
    houseId = addHouse._id
  }

  await db.collection(COL.userHouses).doc(reqId).update({
    data: { house_id: houseId, status: 'bound', approvedAt: now(), approvedBy: openid },
  })
  return ok({ _id: reqId })
}

async function actionHouseReject({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])

  // staff 管辖范围校验
  const existing = await db.collection(COL.userHouses).doc(data._id).get()
  if (existing.data && user.role === 'staff') {
    const mc = Array.isArray(user.managedCommunities) ? user.managedCommunities : []
    if (mc.length && !mc.includes(existing.data.community)) {
      throw new Error('无权审核该小区的房屋绑定')
    }
  }

  await db.collection(COL.userHouses).doc(data._id).update({
    data: { status: 'rejected', rejectedAt: now(), rejectedBy: openid,
      rejectReason: (data.reason || '').slice(0, 100) },
  })
  return ok({ _id: data._id })
}

async function actionHouseAdd({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])
  const community = (data.community || '').trim()
  const building = (data.building || '').trim()
  const unit = (data.unit || '').trim()
  const room = (data.room || '').trim()
  if (!community || !building || !unit || !room) throw new Error('请完整填写房屋地址')

  // 批量添加：如果 data 有 rooms 数组，则批量创建
  if (Array.isArray(data.rooms) && data.rooms.length) {
    const results = []
    for (const r of data.rooms) {
      const rm = String(r).trim()
      if (!rm) continue
      const exist = await db.collection(COL.houses)
        .where({ community, building, unit, room: rm }).limit(1).get()
      if (exist.data && exist.data[0]) { results.push({ room: rm, status: 'existed' }); continue }
      const addRes = await db.collection(COL.houses).add({
        data: { community, building, unit, room: rm, createdAt: now(), createdBy: openid },
      })
      results.push({ room: rm, status: 'added', _id: addRes._id })
    }
    return ok({ community, building, unit, results })
  }

  // 单个添加
  const existed = await db.collection(COL.houses)
    .where({ community, building, unit, room }).limit(1).get()
  if (existed.data && existed.data[0]) return ok({ status: 'existed', house: existed.data[0] })
  const addRes = await db.collection(COL.houses).add({
    data: { community, building, unit, room, createdAt: now(), createdBy: openid },
  })
  return ok({ status: 'added', _id: addRes._id })
}

async function actionHouseListAll({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])
  const pageSize = Math.min(Number(data.pageSize || 50), 200)
  const skip = Math.max(Number(data.skip || 0), 0)
  const where = {}
  if (data.community) where.community = data.community
  const res = await db.collection(COL.houses).where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get()
  const countRes = await db.collection(COL.houses).where(where).count()
  return ok({ items: res.data || [], total: countRes.total })
}

async function actionHouseDelete({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['admin'])
  await db.collection(COL.houses).doc(data._id).remove()
  return ok({ _id: data._id })
}

module.exports = {
  actionHouseBind, actionHouseMyList, actionHousePendingList,
  actionHouseApprove, actionHouseReject,
  actionHouseAdd, actionHouseListAll, actionHouseDelete,
}
