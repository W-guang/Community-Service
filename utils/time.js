function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`
}

function formatDateTime(ts) {
  if (!ts) return ''
  const d = ts instanceof Date ? ts : new Date(ts)
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  return `${y}-${m}-${day} ${hh}:${mm}`
}

module.exports = {
  formatDateTime,
}

