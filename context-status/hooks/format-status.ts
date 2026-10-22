// Pure formatting of the indicator: model name, effort, context bar, token counts, usage level.
import type { ContextFigures } from '../types'

export type StatusLevel = 'unknown' | 'ok' | 'warn' | 'critical'

export type StatusParts = {
  model: string
  effort: string
  bar: string
  // "42% · 84k/200k" in full; the pieces below are what a narrow line keeps.
  usage: string
  // "42%", or "—" before the first measurement.
  percentText: string
  // "84k/200k", or just the window ("200k") before the first measurement.
  tokensText: string
  // " · compact soon" when critical, else ''.
  note: string
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

export function describeStatus(model: string, context: ContextFigures, effort?: string | number): StatusParts {
  const head = { model: formatModelName(model), effort: effort === undefined ? '' : String(effort) }
  const window = formatTokens(context.window)
  const level = usageLevel(context.percent)
  if (context.percent === undefined) {
    return { ...head, bar: '', usage: `— · ${window}`, percentText: '—', tokensText: window, note: '', level }
  }
  const used = context.tokens === undefined ? '?' : formatTokens(context.tokens)
  const note = level === 'critical' ? ' · compact soon' : ''

  return {
    ...head,
    bar: formatBar(context.percent),
    usage: `${context.percent}% · ${used}/${window}${note}`,
    percentText: `${context.percent}%`,
    tokensText: `${used}/${window}`,
    note,
    level,
  }
}

// The indicator as one plain line, e.g. "Opus 5.5 · high · ctx ████░░░░░░ 42% · 84k/200k".
export function formatStatus(model: string, context: ContextFigures, effort?: string | number): string {
  const parts = describeStatus(model, context, effort)
  const bar = parts.bar === '' ? '' : `${parts.bar} `

  return `${formatHead(parts)}ctx ${bar}${parts.usage}`
}

// "Opus 5.5 · high · ", or "Opus 5.5 · " for a model without effort.
export function formatHead(parts: StatusParts): string {
  return parts.effort === '' ? `${parts.model} · ` : `${parts.model} · ${parts.effort} · `
}
