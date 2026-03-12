// 内置函数定义
const BUILT_IN_FUNCTIONS = {
  // 截断字符串，专为 Telegram HTML 模式优化
  truncate: (str: string, maxLength: number) => {
    if (!str) return str;
    
    let cleanStr = str.replace(/<[^>]+>/g, ' ');
    cleanStr = cleanStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    cleanStr = cleanStr.replace(/\s+/g, ' ').trim();

    if (cleanStr.length <= maxLength) return cleanStr;
    return cleanStr.slice(0, maxLength) + '...';
  },

  // 获取当前时间，支持自定义格式和时区偏移
  now: (format = 'YYYY-MM-DD HH:mm:ss', timezone?: number | string) => {
    const date = new Date()
    let targetDate = date
    if (timezone !== undefined) {
      try {
        if (typeof timezone === 'number') {
          const localOffset = date.getTimezoneOffset()
          const targetOffset = timezone * 60
          const diffOffset = targetOffset + localOffset
          targetDate = new Date(date.getTime() + diffOffset * 60 * 1000)
        } else {
          const dateStr = date.toLocaleString('en-US', { timeZone: timezone })
          targetDate = new Date(dateStr)
        }
      } catch {
        console.warn(`时区设置无效: ${timezone}, 将使用本地时区`)
      }
    }
    const tokens: Record<string, () => string> = {
      YYYY: () => targetDate.getFullYear().toString(),
      MM: () => (targetDate.getMonth() + 1).toString().padStart(2, '0'),
      DD: () => targetDate.getDate().toString().padStart(2, '0'),
      HH: () => targetDate.getHours().toString().padStart(2, '0'),
      mm: () => targetDate.getMinutes().toString().padStart(2, '0'),
      ss: () => targetDate.getSeconds().toString().padStart(2, '0')
    }
    return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => tokens[match]())
  },

  // 智能识别验证码并返回点击复制格式
  findCode: (str: string) => {
    if (!str) return '';
    const cleanStr = str.replace(/<[^>]+>/g, ' ');
    const match = cleanStr.match(/(?<!\d|20)\d{4,8}(?!\d)/);
    
    if (match) {
      return `🔑 验证码 (点击复制): <code>${match[0]}</code>\n`;
    }
    return '';
  },
} as const

type BuiltInFunction = keyof typeof BUILT_IN_FUNCTIONS

// 函数调用正则表达式
const FUNCTION_CALL_REGEX = /\${(\w+)\((.*?)\)}/g
// 变量替换正则表达式
const VARIABLE_REGEX = /\${([\w.]+)}/g

export function safeInterpolate(
    template: string,
    data: Record<string, any>,
    fallback = ''
): string {
    let result = template.replace(FUNCTION_CALL_REGEX, (_, fnName, argsStr) => {
        try {
            const fn = BUILT_IN_FUNCTIONS[fnName as BuiltInFunction]
            if (!fn) throw new Error(`未知的函数: ${fnName}`)

            const args = argsStr.split(',').map((arg: string) => {
                const trimmed = arg.trim()
                const parts = trimmed.split('.')
                if (parts.length > 1) {
                    return parts.reduce((acc: any, part: string) => {
                        if (acc === null || acc === undefined) {
                            throw new Error(`Cannot read property '${part}' of ${acc}`)
                        }
                        return acc[part]
                    }, data)
                }
                if (/^\d+$/.test(trimmed)) {
                    return parseInt(trimmed, 10)
                }
                return trimmed.replace(/^["']|["']$/g, '')
            })

            // @ts-expect-error "ignore"
            const fnResult = fn(...args)

            if (typeof fnResult === 'string') {
                return fnResult
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t')
                    .replace(/"/g, '\\"')
            }
            return fnResult === undefined ? fallback : String(fnResult)

        } catch (error: any) {
            console.warn(`函数调用错误: ${error.message}`)
            return fallback
        }
    })

    result = result.replace(VARIABLE_REGEX, (_, path) => {
        try {
            const value = path.split('.').reduce((acc: any, part: string) => {
                if (acc === null || acc === undefined) {
                    throw new Error(`Cannot read property '${part}' of ${acc}`)
                }
                return acc[part]
            }, data)

            if (typeof value === 'string') {
                return value
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t')
                    .replace(/"/g, '\\"')
            }
            return value === undefined ? fallback : String(value)
        } catch (error: any) {
            console.warn(`变量解析错误: ${error.message}`)
            return fallback
        }
    })

    return result
}
