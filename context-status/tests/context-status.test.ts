// Covers the status text format (TC-1..TC-5) and the engine wiring (TC-6..TC-8).
import { expect, test } from 'claude-code/testing'

import { formatModelName, formatStatus, formatTokens } from '../hooks/format-status'

test('TC-1 model names', () => {
  expect(formatModelName('claude-opus-5-5')).toBe('Opus 5.5')
  expect(formatModelName('claude-sonnet-5-5[1m]')).toBe('Sonnet 5.5 [1m]')
  expect(formatModelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  expect(formatModelName('my-gateway-model')).toBe('my-gateway-model')
})

test('TC-2 bar, percent and tokens', () => {
  const text = formatStatus('claude-opus-5-5', { tokens: 84_000, window: 200_000, percent: 42 })
  expect(text).toBe('Opus 5.5 · ctx ████░░░░░░ 42% · 84k/200k')
})

test('TC-3 token abbreviations', () => {
  expect(formatTokens(1_000_000)).toBe('1M')
  expect(formatTokens(1_500)).toBe('1.5k')
  expect(formatTokens(950)).toBe('950')
})

test('TC-4 no measurement yet', () => {
  expect(formatStatus('claude-opus-5-5', { window: 200_000 })).toBe('Opus 5.5 · ctx — · 200k')
})

test('TC-5 warnings', () => {
  expect(formatStatus('x', { tokens: 170_000, window: 200_000, percent: 85 })).toMatch(/^⚠ x/)
  expect(formatStatus('x', { tokens: 192_000, window: 200_000, percent: 96 })).toMatch(/compact soon$/)
})

const MEASURE = {
  context: { tokens: 50_000, window: 200_000, percent: 25 },
  rateLimits: [],
  changed: ['context' as const],
}

test('TC-6 and TC-7 a measurement paints the line once', async ($, on) => {
  const lines: (string | undefined)[] = []
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.status', (_$, e) => (lines.push(e.text), { value: undefined }))

  await $.session.measure(MEASURE)
  await $.session.measure(MEASURE)

  expect(lines).toEqual(['Opus 5.5 · ctx ███░░░░░░░ 25% · 50k/200k'])
})

test('TC-8 a failed read leaves the session alone', async ($, on) => {
  const lines: (string | undefined)[] = []
  on('session.model', () => ({ deny: 'unavailable' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.status', (_$, e) => (lines.push(e.text), { value: undefined }))

  await $.session.measure(MEASURE)

  expect(lines).toEqual([])
})
