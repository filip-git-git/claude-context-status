// Pure handling of the 5-hour and weekly rate-limit windows: picking, mini bar, countdown.
import type { LimitFigures, LimitWindow } from '../types'

// One window as the engine reports it (SessionRateLimit).
export type RateLimitReading = { kind: string; percentUsed: number; resetsAt?: string }

export type LimitLabel = '5h' | '7d'

export type LimitSegment = {
  label: LimitLabel
  bar: string
  // "23%", or "—" when the window reset since the reading.
  percentText: string
  // undefined when the reading is stale.
  percent?: number
  // "2h14m", or '' when the reset time is unknown or passed.
  reset: string
}

const MINI_BAR_CELLS = 5
const MINUTE_MS = 60_000

export function pickLimits(readings: readonly RateLimitReading[]): LimitFigures {
  const limits: LimitFigures = {}
  for (const reading of readings) {
    const window: LimitWindow = { percent: reading.percentUsed }
    if (reading.resetsAt !== undefined) {
      window.resetsAt = reading.resetsAt
    }
    if (reading.kind === 'five_hour') {
      limits.fiveHour = window
    } else if (reading.kind === 'seven_day') {
      limits.sevenDay = window
    }
  }

  return limits
}

export function formatMiniBar(percent: number): string {
  const clamped = Math.min(100, Math.max(0, percent))
  const filled = Math.round(clamped / (100 / MINI_BAR_CELLS))

  return '█'.repeat(filled) + '░'.repeat(MINI_BAR_CELLS - filled)
}

// 45 min -> "45m", 2 h 14 min -> "2h14m", 3 d 4 h -> "3d4h"; partial minutes round up.
export function formatCountdown(remainingMs: number): string {
  const minutes = Math.max(1, Math.ceil(remainingMs / MINUTE_MS))
  if (minutes < 60) {
    return `${minutes}m`
  }
  if (minutes < 24 * 60) {
    return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
  }

  return `${Math.floor(minutes / (24 * 60))}d${Math.floor((minutes % (24 * 60)) / 60)}h`
}

export function describeLimit(label: LimitLabel, window: LimitWindow, nowMs: number): LimitSegment {
  const resetMs = window.resetsAt === undefined ? Number.NaN : Date.parse(window.resetsAt)
  if (!Number.isNaN(resetMs) && resetMs <= nowMs) {
    return { label, bar: formatMiniBar(0), percentText: '—', reset: '' }
  }
  const reset = Number.isNaN(resetMs) ? '' : formatCountdown(resetMs - nowMs)

  return {
    label,
    bar: formatMiniBar(window.percent),
    percentText: `${Math.round(window.percent)}%`,
    percent: window.percent,
    reset,
  }
}

export function describeLimits(limits: LimitFigures | undefined, nowMs: number): LimitSegment[] {
  const segments: LimitSegment[] = []
  if (limits?.fiveHour !== undefined) {
    segments.push(describeLimit('5h', limits.fiveHour, nowMs))
  }
  if (limits?.sevenDay !== undefined) {
    segments.push(describeLimit('7d', limits.sevenDay, nowMs))
  }

  return segments
}

// The minute countdowns are measured from, or 0 when no window has a reset time.
export function countdownMinute(limits: LimitFigures, nowMs: number): number {
  const counts = limits.fiveHour?.resetsAt !== undefined || limits.sevenDay?.resetsAt !== undefined

  return counts ? Math.floor(nowMs / MINUTE_MS) : 0
}
