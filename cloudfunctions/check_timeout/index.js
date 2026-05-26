/**
 * 报修超时预警 - 定时触发器云函数
 * 检查 pending/processing 状态的工单是否超过时限，自动记录预警
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const TIMEOUT_HOURS = 2

exports.main = async () => {
  const now = Date.now()
  const threshold = now - TIMEOUT_HOURS * 3600 * 1000

  const { data: items } = await db.collection('repairs')
    .where(_.and([
      { status: _.in(['pending', 'processing']) },
      { timeout_at: _.lt(now) },
    ]))
    .limit(100)
    .get()

  const results = []
  for (const repair of items) {
    const overdueMs = now - repair.timeout_at
    const overdueMin = Math.floor(overdueMs / 60000)
    const note = repair.status === 'pending'
      ? `超时预警：工单已提交 ${Math.floor((now - repair.createdAt) / 3600000)} 小时，尚未受理`
      : `超时预警：工单处理中已超时 ${overdueMin} 分钟`

    await db.collection('repair_comments').add({
      data: {
        repairId: repair._id,
        fromOpenid: '__system__',
        fromRole: 'system',
        fromName: '系统预警',
        content: note,
        createdAt: now,
      },
    })

    results.push({ _id: repair._id, status: repair.status, overdueMin, note })
  }

  return { ok: true, count: results.length, results }
}
