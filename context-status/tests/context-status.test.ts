// Covers the indicator format (TC-1..TC-5) and the band drawn above the prompt (TC-6..TC-8).
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { describeStatus, formatModelName, formatStatus, formatTokens } from '../hooks/format-status'

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
  expect(describeStatus('x', { window: 200_000 }).level).toBe('unknown')
})

test('TC-5 usage levels', () => {
  expect(describeStatus('x', { tokens: 100_000, window: 200_000, percent: 50 }).level).toBe('ok')
  expect(describeStatus('x', { tokens: 170_000, window: 200_000, percent: 85 }).level).toBe('warn')
  const critical = describeStatus('x', { tokens: 192_000, window: 200_000, percent: 96 })
  expect(critical.level).toBe('critical')
  expect(critical.usage).toMatch(/compact soon$/)
})

const MEASURE = {
  context: { tokens: 50_000, window: 200_000, percent: 25 },
  rateLimits: [],
  changed: ['context' as const],
}

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

async function bandText($: Engine, props = BAND): Promise<string | undefined> {
  const ui = await $.ui.mount({ plugin: 'context-status', surface: 'terminal', component: 'AbovePrompt', props })
  const box = await ui.find({ key: 'context-status' })
  await ui.unmount()

  return box?.text
}

test('TC-6 a measurement draws the band with model and usage', async ($, on) => {
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [] }))

  await $.session.measure(MEASURE)

  expect(await bandText($)).toBe('Opus 5.5 · ctx ███░░░░░░░ 25% · 50k/200k')
})

test('TC-7 the band yields to a survey', async ($, on) => {
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [] }))

  await $.session.measure(MEASURE)

  expect(await bandText($, { ...BAND, hasSurvey: true })).toBeUndefined()
})

test('TC-8 a failed read draws nothing and breaks nothing', async ($, on) => {
  on('session.model', () => ({ deny: 'unavailable' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [] }))

  await $.session.measure(MEASURE)

  expect(await bandText($)).toBeUndefined()
})
