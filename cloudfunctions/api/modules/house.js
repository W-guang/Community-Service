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
  await db.collection(COL.userHouses).doc(data._id).update({
    data: { status: 'rejected', rejectedAt: now(), rejectedBy: openid,
      rejectReason: (data.reason || '').slice(0, 100) },
  })
  return ok({ _id: data._id })
}

module.exports = {
  actionHouseBind, actionHouseMyList, actionHousePendingList,
  actionHouseApprove, actionHouseReject,
}
