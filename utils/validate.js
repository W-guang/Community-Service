/**
 * 前端输入校验工具模块
 * 提供常用校验器与表单批量校验，在提交前对用户输入做双端校验
 */

const rules = {
  required(value, msg) {
    if (value === undefined || value === null || String(value).trim() === '') {
      return msg || '此项为必填'
    }
    return ''
  },
  maxLength(max) {
    return (value, msg) => {
      if (value && String(value).length > max) return msg || `最多${max}个字符`
      return ''
    }
  },
  range(min, max) {
    return (value, msg) => {
      const n = Number(value)
      if (isNaN(n) || n < min || n > max) return msg || `取值范围 ${min}-${max}`
      return ''
    }
  },
  phone(value, msg) {
    if (!value) return '' // 可选字段
    const digits = String(value).replace(/\D/g, '')
    if (digits.length > 0 && !/^1[3-9]\d{9}$/.test(digits)) return msg || '手机号格式不正确（需11位）'
    return ''
  },
}

/**
 * 批量校验表单
 * @param {object} form  表单数据 { field: value, ... }
 * @param {object} schema  校验规则 { field: [validatorFn, ...], ... }
 * @returns {{ valid: boolean, errors: object, first: string }}
 */
function validateForm(form, schema) {
  const errors = {}
  for (const [field, fns] of Object.entries(schema)) {
    for (const fn of fns) {
      const msg = fn(form[field])
      if (msg) {
        errors[field] = msg
        break
      }
    }
  }
  const first = Object.values(errors)[0] || ''
  return { valid: Object.keys(errors).length === 0, errors, first }
}

module.exports = { rules, validateForm }
