// Covers the 5-hour and weekly limit segments (TC-12..TC-20, UC-002).
import { expect, test } from 'claude-code/testing'

import { describeLimit, formatCountdown, formatMiniBar, pickLimits } from '../hooks/rate-limits'
import { buildLine, fitLine, lineText } from '../hooks/status-line'
import type { StatusSnapshot } from '../types'
import { MEASURE, NOW, bandText, inMinutes, stubSession } from './engine-stubs'

const LIMITS = [
  { kind: 'five_hour', percentUsed: 23.4, resetsAt: inMinutes(134) },
  { kind: 'seven_day', percentUsed: 41, resetsAt: inMinutes(3 * 24 * 60 + 4 * 60) },
]

const SNAPSHOT: StatusSnapshot = {
  model: 'claude-opus-5-5',
  effort: 'high',
  context: { tokens: 420_000, window: 1_000_000, percent: 42 },
  limits: pickLimits(LIMITS),
  minute: NOW / 60_000,
}

const FULL = 'Opus 5.5 · high · ctx ████░░░░░░ 42% · 420k/1M │ 5h █░░░░ 23% 2h14m │ 7d ██░░░ 41% 3d4h'

test('TC-12 windows are picked by kind and other kinds are ignored', () => {
  const limits = pickLimits([...LIMITS, { kind: 'spend_limit', percentUsed: 120 }])
  expect(limits.fiveHour?.percent).toBe(23.4)
  expect(limits.sevenDay?.percent).toBe(41)
  expect(Object.keys(limits).sort()).toEqual(['fiveHour', 'sevenDay'])
})

test('TC-13 five-cell bar', () => {
  expect(formatMiniBar(0)).toBe('░░░░░')
  expect(formatMiniBar(23)).toBe('█░░░░')
  expect(formatMiniBar(41)).toBe('██░░░')
  expect(formatMiniBar(130)).toBe('█████')
})

test('TC-14 countdown', () => {
  expect(formatCountdown(45 * 60_000)).toBe('45m')
  expect(formatCountdown(134 * 60_000)).toBe('2h14m')
  expect(formatCountdown(125 * 60_000)).toBe('2h05m')
  expect(formatCountdown((3 * 24 * 60 + 4 * 60) * 60_000)).toBe('3d4h')
  expect(formatCountdown(20_000)).toBe('1m')
})

test('TC-15 a window past its reset shows a dash; no reset time shows no countdown', () => {
  const stale = describeLimit('5h', { percent: 90, resetsAt: inMinutes(-1) }, NOW)
  expect([stale.bar, stale.percentText, stale.reset, stale.percent]).toEqual(['░░░░░', '—', '', undefined])
  const noReset = describeLimit('7d', { percent: 41 }, NOW)
  expect([noReset.percentText, noReset.reset]).toEqual(['41%', ''])
})

test('TC-16 limit segments take the context thresholds', () => {
  const line = (percent: number) =>
    buildLine({ ...SNAPSHOT, limits: { fiveHour: { percent } } }, { tokens: true, resets: true, limitBars: true })
  const barTone = (percent: number) => line(percent).find(piece => piece.text === `${formatMiniBar(percent)} `)?.tone
  expect([barTone(50), barTone(85), barTone(96)]).toEqual(['ok', 'warn', 'critical'])
})

test('TC-17 no windows keeps the 0.3.0 line; one window draws one segment', () => {
  const full = { tokens: true, resets: true, limitBars: true }
  expect(lineText(buildLine({ ...SNAPSHOT, limits: {} }, full))).toBe('Opus 5.5 · high · ctx ████░░░░░░ 42% · 420k/1M')
  expect(lineText(buildLine({ ...SNAPSHOT, limits: undefined }, full))).toBe('Opus 5.5 · high · ctx ████░░░░░░ 42% · 420k/1M')
  const oneWindow = lineText(buildLine({ ...SNAPSHOT, limits: { sevenDay: { percent: 41 } } }, full))
  expect(oneWindow).toBe('Opus 5.5 · high · ctx ████░░░░░░ 42% · 420k/1M │ 7d ██░░░ 41%')
})

test('TC-18 a narrow band drops tokens, then countdowns, then limit bars', () => {
  expect(lineText(fitLine(SNAPSHOT, 200))).toBe(FULL)
  const noTokens = 'Opus 5.5 · high · ctx ████░░░░░░ 42% │ 5h █░░░░ 23% 2h14m │ 7d ██░░░ 41% 3d4h'
  expect(lineText(fitLine(SNAPSHOT, FULL.length - 1))).toBe(noTokens)
  const noResets = 'Opus 5.5 · high · ctx ████░░░░░░ 42% │ 5h █░░░░ 23% │ 7d ██░░░ 41%'
  expect(lineText(fitLine(SNAPSHOT, noTokens.length - 1))).toBe(noResets)
  const bare = 'Opus 5.5 · high · ctx ████░░░░░░ 42% │ 5h 23% │ 7d 41%'
  expect(lineText(fitLine(SNAPSHOT, noResets.length - 1))).toBe(bare)
  expect(lineText(fitLine(SNAPSHOT, 10))).toBe(bare)
})

test('TC-19 a measurement with limits draws the segments in the band', async ($, on) => {
  stubSession(on)

  await $.session.measure({ ...MEASURE, rateLimits: LIMITS, changed: ['context', 'rateLimits'] })

  const expected = 'Opus 5.5 · high · ctx ███░░░░░░░ 25% · 50k/200k │ 5h █░░░░ 23% 2h14m │ 7d ██░░░ 41% 3d4h'
  expect(await bandText($)).toBe(expected)
})

test('TC-20 the same figures in the same minute write the state once', async ($, on) => {
  let writes = 0
  stubSession(on, { now: NOW + 20_000 })
  on('state.set', async (_$, e, next) => ((writes += 1), next(e)))

  const measured = { ...MEASURE, rateLimits: LIMITS, changed: ['rateLimits' as const] }
  await $.session.measure(measured)
  await $.session.measure(measured)

  expect(writes).toBe(1)
})
