/**
 * 治理数据看板模块
 */
const { db, COL, now, ok, getOrCreateUser, requireRole } = require('./common')

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

async function actionDashboardExport({ openid, data }) {
  const user = await getOrCreateUser(openid)
  requireRole(user, ['staff', 'admin'])
  const type = data.type || 'summary'

  const result = { exportedAt: now(), type }

  if (type === 'repairs' || type === 'all') {
    const { data: items } = await db.collection(COL.repairs).orderBy('createdAt', 'desc').limit(500).get()
    result.repairs = items
  }
  if (type === 'helps' || type === 'all') {
    const { data: items } = await db.collection(COL.helps).orderBy('createdAt', 'desc').limit(500).get()
    result.helps = items
  }
  if (type === 'sos' || type === 'all') {
    const { data: items } = await db.collection(COL.sos).orderBy('createdAt', 'desc').limit(500).get()
    result.sos = items
  }

  const [repairsTotal, helpsTotal, noticesTotal, sosTotal, usersTotal] = await Promise.all([
    db.collection(COL.repairs).count(),
    db.collection(COL.helps).count(),
    db.collection(COL.notices).count(),
    db.collection(COL.sos).count(),
    db.collection(COL.users).count(),
  ])
  result.summary = {
    repairs: repairsTotal.total,
    helps: helpsTotal.total,
    notices: noticesTotal.total,
    sos: sosTotal.total,
    users: usersTotal.total,
  }

  return ok(result)
}

module.exports = { actionDashboardStats, actionDashboardExport }
