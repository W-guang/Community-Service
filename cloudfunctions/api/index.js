/**
 * 邻智灵云函数入口 — 路由分发器
 * 按业务领域拆分为独立模块：auth / house / repair / help / notice / sos / dashboard
 * 共享工具模块 common.js 提供数据库实例、守卫函数、响应格式化
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { fail } = require('./modules/common')
const auth = require('./modules/auth')
const house = require('./modules/house')
const repair = require('./modules/repair')
const help = require('./modules/help')
const notice = require('./modules/notice')
const sos = require('./modules/sos')
const dashboard = require('./modules/dashboard')

const ROUTES = {
  auth: auth.actionAuth,
  'user.update': auth.actionUserUpdate,
  'admin.userSetRole': auth.actionAdminUserSetRole,
  'admin.add': auth.actionAdminAdd,
  'admin.remove': auth.actionAdminRemove,

  'house.bind': house.actionHouseBind,
  'house.myList': house.actionHouseMyList,
  'house.pendingList': house.actionHousePendingList,
  'house.approve': house.actionHouseApprove,
  'house.reject': house.actionHouseReject,

  'repair.create': repair.actionRepairCreate,
  'repair.list': repair.actionRepairList,
  'repair.detail': repair.actionRepairDetail,
  'repair.updateStatus': repair.actionRepairUpdateStatus,
  'repair.comment': repair.actionRepairComment,

  'help.create': help.actionHelpCreate,
  'help.list': help.actionHelpList,
  'help.detail': help.actionHelpDetail,
  'help.take': help.actionHelpTake,
  'help.addProgress': help.actionHelpAddProgress,
  'help.updateStatus': help.actionHelpUpdateStatus,
  'help.rate': help.actionHelpRate,

  'notice.create': notice.actionNoticeCreate,
  'notice.list': notice.actionNoticeList,
  'notice.detail': notice.actionNoticeDetail,
  'notice.markRead': notice.actionNoticeMarkRead,
  'notice.stats': notice.actionNoticeStats,

  'sos.create': sos.actionSosCreate,
  'sos.list': sos.actionSosList,
  'sos.updateStatus': sos.actionSosUpdateStatus,

  'dashboard.stats': dashboard.actionDashboardStats,
  'dashboard.export': dashboard.actionDashboardExport,
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
