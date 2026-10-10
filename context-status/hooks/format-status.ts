// Pure formatting of the indicator: model name, context bar, token counts, usage level.
import type { ContextFigures } from '../types'

export type StatusLevel = 'unknown' | 'ok' | 'warn' | 'critical'

export type StatusParts = {
  model: string
  bar: string
  usage: string
  level: StatusLevel
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

export function usageLevel(percent: number | undefined): StatusLevel {
  if (percent === undefined) {
    return 'unknown'
  }
  if (percent >= CRITICAL_PERCENT) {
    return 'critical'
  }

  return percent >= WARN_PERCENT ? 'warn' : 'ok'
}

export function describeStatus(model: string, context: ContextFigures): StatusParts {
  const window = formatTokens(context.window)
  const level = usageLevel(context.percent)
  if (context.percent === undefined) {
    return { model: formatModelName(model), bar: '', usage: `— · ${window}`, level }
  }
  const used = context.tokens === undefined ? '?' : formatTokens(context.tokens)
  const note = level === 'critical' ? ' · compact soon' : ''

  return {
    model: formatModelName(model),
    bar: formatBar(context.percent),
    usage: `${context.percent}% · ${used}/${window}${note}`,
    level,
  }
}

// The indicator as one plain line, e.g. "Opus 5.5 · ctx ████░░░░░░ 42% · 84k/200k".
export function formatStatus(model: string, context: ContextFigures): string {
  const parts = describeStatus(model, context)
  const bar = parts.bar === '' ? '' : `${parts.bar} `

  return `${parts.model} · ctx ${bar}${parts.usage}`
}
