// Covers the indicator format (TC-1..TC-5), the band above the prompt (TC-6..TC-8) and the effort (TC-9..TC-11).
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { effortFromSettings, pickEffort } from '../hooks/effort-level'
import type { EffortTracker } from '../hooks/effort-level'
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
  const withEffort = formatStatus('claude-opus-5-5', { tokens: 84_000, window: 200_000, percent: 42 }, 'high')
  expect(withEffort).toBe('Opus 5.5 · high · ctx ████░░░░░░ 42% · 84k/200k')
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

const SETTINGS = { effortLevel: 'medium', modelSettings: { 'claude-opus-5-5': { effortLevel: 'high' } } }

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
  on('settings.read', () => ({ value: SETTINGS }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [] }))

  await $.session.measure(MEASURE)

  expect(await bandText($)).toBe('Opus 5.5 · high · ctx ███░░░░░░░ 25% · 50k/200k')
})

test('TC-7 the band yields to a survey', async ($, on) => {
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('settings.read', () => ({ value: SETTINGS }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [] }))

  await $.session.measure(MEASURE)

  expect(await bandText($, { ...BAND, hasSurvey: true })).toBeUndefined()
})

test('TC-8 a failed read draws nothing and breaks nothing', async ($, on) => {
  on('session.model', () => ({ deny: 'unavailable' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('settings.read', () => ({ value: SETTINGS }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [] }))

  await $.session.measure(MEASURE)

  expect(await bandText($)).toBeUndefined()
})

test('TC-9 effort from settings: per model first, then the top level', () => {
  expect(effortFromSettings(SETTINGS, 'claude-opus-5-5')).toBe('high')
  expect(effortFromSettings(SETTINGS, 'claude-sonnet-5-5')).toBe('medium')
  expect(effortFromSettings({}, 'claude-opus-5-5')).toBeUndefined()
})

test('TC-10 a turn effort holds until the settings or the model change', () => {
  const tracker: EffortTracker = {}
  expect(pickEffort(tracker, 'high', 'm')).toBe('high')
  tracker.fromTurn = 'max'
  expect(pickEffort(tracker, 'high', 'm')).toBe('max')
  expect(pickEffort(tracker, 'low', 'm')).toBe('low')
  tracker.fromTurn = 'max'
  expect(pickEffort(tracker, 'low', 'other')).toBe('low')
})

test('TC-11 the main loop request effort reaches the band', async ($, on) => {
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('session.usage', () => ({ value: { startedAt: 0, context: MEASURE.context, rateLimits: [] } }))
  on('settings.read', () => ({ value: SETTINGS }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [] }))
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })

  await $.session.measure(MEASURE)
  for await (const _chunk of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', effort: 'max', messageCount: 1 })) {
    // drain the stream
  }

  expect(await bandText($)).toBe('Opus 5.5 · max · ctx ███░░░░░░░ 25% · 50k/200k')
})
