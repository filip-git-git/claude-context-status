// Shared test fixtures: the engine answers a session would give, and a mounted band's text.
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

// 2026-10-22T10:00:00Z, a whole minute.
export const NOW = Date.UTC(2026, 9, 22, 10, 0, 0)

export const MEASURE = {
  context: { tokens: 50_000, window: 200_000, percent: 25 },
  rateLimits: [],
  changed: ['context' as const],
}

export const SETTINGS = { effortLevel: 'medium', modelSettings: { 'claude-opus-5-5': { effortLevel: 'high' } } }

export const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

// ISO time `minutes` after NOW.
export function inMinutes(minutes: number): string {
  return new Date(NOW + minutes * 60_000).toISOString()
}

// Answers model, settings, clock and the band's fallback the way a session does;
// `model: false` leaves session.model for the test to answer.
export function stubSession(on: On, options: { now?: number; model?: boolean } = {}): void {
  if (options.model !== false) {
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
  }
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('settings.read', () => ({ value: SETTINGS }))
  on('clock.now', () => ({ value: options.now ?? NOW }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [] }))
}

export async function bandText($: Engine, props = BAND): Promise<string | undefined> {
  const ui = await $.ui.mount({ plugin: 'context-status', surface: 'terminal', component: 'AbovePrompt', props })
  const box = await ui.find({ key: 'context-status' })
  await ui.unmount()

  return box?.text
}
