// Draws a band above the prompt with the main-loop model, its effort and context window fill.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import { effortFromSettings, pickEffort } from './effort-level'
import type { EffortTracker } from './effort-level'
import { describeStatus, formatHead } from './format-status'
import type { StatusLevel } from './format-status'
import type { ContextFigures, StatusSnapshot } from '../types'

// /model and /effort have no mod event, so a cheap poll catches a switch between turns.
const POLL_MS = 5000

const LEVEL_COLOR: Record<StatusLevel, string> = {
  unknown: 'subtle',
  ok: 'success',
  warn: 'warning',
  critical: 'error',
}

const snapshot = atom({ plugin: 'context-status', key: 'snapshot' } as const, null)

function isSame(a: StatusSnapshot | null, b: StatusSnapshot): boolean {
  return (
    a !== null &&
    a.model === b.model &&
    a.effort === b.effort &&
    a.context.tokens === b.context.tokens &&
    a.context.window === b.context.window &&
    a.context.percent === b.context.percent
  )
}

// Reads model, effort and usage (all local, free calls); the band redraws only when a figure changed.
async function refresh($: EngineInterface, tracker: EffortTracker, measured?: ContextFigures): Promise<void> {
  try {
    const model = await $.session.model()
    const settings = await $.settings.read()
    const effort = pickEffort(tracker, effortFromSettings(settings, model), model)
    const { tokens, window, percent } = measured ?? (await $.session.usage()).context
    const next: StatusSnapshot = { model, effort, context: { tokens, window, percent } }
    await update($, snapshot, previous => (isSame(previous, next) ? previous : next))
  } catch {
    // Keep the last known figures; a failed read must never break the session.
  }
}

export const register: Register = on => {
  let poll: Timer | undefined
  const tracker: EffortTracker = {}

  on('session.start', async ($, e, next) => {
    $.ui.status(undefined) // clears the line version 0.1.0 of this mod pinned
    await refresh($, tracker)
    poll?.cancel()
    poll = $.clock.every(POLL_MS, () => void refresh($, tracker))

    return next(e)
  })

  // The effort the main loop actually sends, after any downgrade for the model.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined && e.effort !== tracker.fromTurn) {
      tracker.fromTurn = e.effort
      await refresh($, tracker)
    }

    return yield* next(e)
  })

  on('session.measure', async ($, e, next) => {
    await refresh($, tracker, e.context)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($, tracker)

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, snapshot)
    if (e.props.hasSurvey || current === null) {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)
    const parts = describeStatus(current.model, current.context, current.effort)
    const color = LEVEL_COLOR[parts.level]

    return (
      <Box key="context-status">
        <Text dimColor wrap="truncate">
          {`${formatHead(parts)}ctx `}
        </Text>
        <Text key="bar" color={color} wrap="truncate">
          {parts.bar === '' ? '' : `${parts.bar} `}
        </Text>
        <Text key="usage" color={parts.level === 'ok' ? undefined : color} wrap="truncate">
          {parts.usage}
        </Text>
      </Box>
    )
  })
}
