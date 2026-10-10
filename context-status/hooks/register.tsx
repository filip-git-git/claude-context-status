// Draws a band above the prompt with the main-loop model and context window fill.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import { describeStatus } from './format-status'
import type { StatusLevel } from './format-status'
import type { ContextFigures, StatusSnapshot } from '../types'

// /model has no mod event, so a cheap poll catches a switch between turns.
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
    a.context.tokens === b.context.tokens &&
    a.context.window === b.context.window &&
    a.context.percent === b.context.percent
  )
}

// Reads model and usage (both free calls); the band redraws only when a figure changed.
async function refresh($: EngineInterface, measured?: ContextFigures): Promise<void> {
  try {
    const model = await $.session.model()
    const { tokens, window, percent } = measured ?? (await $.session.usage()).context
    const next: StatusSnapshot = { model, context: { tokens, window, percent } }
    await update($, snapshot, previous => (isSame(previous, next) ? previous : next))
  } catch {
    // Keep the last known figures; a failed read must never break the session.
  }
}

export const register: Register = on => {
  let poll: Timer | undefined

  on('session.start', async ($, e, next) => {
    $.ui.status(undefined) // clears the line an earlier version of this mod pinned
    await refresh($)
    poll?.cancel()
    poll = $.clock.every(POLL_MS, () => void refresh($))

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await refresh($, e.context)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($)

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, snapshot)
    if (e.props.hasSurvey || current === null) {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)
    const parts = describeStatus(current.model, current.context)
    const color = LEVEL_COLOR[parts.level]

    return (
      <Box key="context-status">
        <Text dimColor wrap="truncate">
          {`${parts.model} · ctx `}
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
