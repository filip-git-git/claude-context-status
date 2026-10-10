// Pure formatting of the status line text: model name, context bar, token counts.

export type ContextFigures = {
  tokens?: number
  window: number
  percent?: number
}

const BAR_CELLS = 10
const WARN_PERCENT = 80
const CRITICAL_PERCENT = 95

// "claude-opus-5-5" -> "Opus 5.5"; "claude-sonnet-5-5[1m]" -> "Sonnet 5.5 [1m]"; anything else unchanged.
export function formatModelName(model: string): string {
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d+))?(?:-\d{8})?(\[[^\]]+\])?$/i.exec(model.trim())
  if (match === null) {
    return model.trim()
  }
  const [, family = '', major, minor, suffix] = match
  const name = family.charAt(0).toUpperCase() + family.slice(1).toLowerCase()
  const version = minor === undefined ? major : `${major}.${minor}`

  return suffix === undefined ? `${name} ${version}` : `${name} ${version} ${suffix}`
}

// 950 -> "950", 1500 -> "1.5k", 84000 -> "84k", 1000000 -> "1M".
export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${trimZero(count / 1_000_000)}M`
  }
  if (count >= 1_000) {
    return `${trimZero(count / 1_000)}k`
  }

  return String(Math.round(count))
}

function trimZero(value: number): string {
  return value >= 100 ? String(Math.round(value)) : String(Number(value.toFixed(1)))
}

export function formatBar(percent: number): string {
  const clamped = Math.min(100, Math.max(0, percent))
  const filled = Math.round(clamped / (100 / BAR_CELLS))

  return '█'.repeat(filled) + '░'.repeat(BAR_CELLS - filled)
}

export function formatContext(context: ContextFigures): string {
  const window = formatTokens(context.window)
  if (context.percent === undefined) {
    return `ctx — · ${window}`
  }
  const used = context.tokens === undefined ? '?' : formatTokens(context.tokens)
  const critical = context.percent >= CRITICAL_PERCENT ? ' · compact soon' : ''

  return `ctx ${formatBar(context.percent)} ${context.percent}% · ${used}/${window}${critical}`
}

export function formatStatus(model: string, context: ContextFigures): string {
  const warning = context.percent !== undefined && context.percent >= WARN_PERCENT ? '⚠ ' : ''

  return `${warning}${formatModelName(model)} · ${formatContext(context)}`
}
