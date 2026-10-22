// Draws a band above the prompt: model, effort, context window fill, and the 5-hour and weekly limits.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import { effortFromSettings, pickEffort } from './effort-level'
import type { EffortTracker } from './effort-level'
import { countdownMinute, pickLimits } from './rate-limits'
import type { RateLimitReading } from './rate-limits'
import { fitLine } from './status-line'
import type { Tone } from './status-line'
import type { ContextFigures, StatusSnapshot } from '../types'

// /model and /effort have no mod event, so a cheap poll catches a switch between turns;
// it also moves the reset countdowns on, at most once a minute.
const POLL_MS = 5000

const TONE_COLOR: Record<Exclude<Tone, 'dim' | 'plain'>, string> = {
  unknown: 'subtle',
  ok: 'success',
  warn: 'warning',
  critical: 'error',
}

// What session.measure pushes; refresh reads the same from $.session.usage() otherwise.
type Measured = { context: ContextFigures; rateLimits: readonly RateLimitReading[] }

const snapshot = atom({ plugin: 'context-status', key: 'snapshot' } as const, null)

function isSame(a: StatusSnapshot | null, b: StatusSnapshot): boolean {
  return a !== null && JSON.stringify(a) === JSON.stringify(b)
}

// Reads model, effort, usage and limits (all local, free calls); the band redraws only when a figure changed.
async function refresh($: EngineInterface, tracker: EffortTracker, measured?: Measured): Promise<void> {
  try {
    const model = await $.session.model()
    const settings = await $.settings.read()
    const effort = pickEffort(tracker, effortFromSettings(settings, model), model)
    const { context, rateLimits } = measured ?? (await $.session.usage())
    const limits = pickLimits(rateLimits)
    const minute = countdownMinute(limits, await $.clock.now())
    const next: StatusSnapshot = {
      model,
      effort,
      context: { tokens: context.tokens, window: context.window, percent: context.percent },
      limits,
      minute,
    }
    const previous = await read($, snapshot)
    if (!isSame(previous, next)) {
      await update($, snapshot, () => next)
    }
  } catch {
    // Keep the last known figures; a failed read must never break the session.
  }
}

function toneProps(tone: Tone): { dimColor?: boolean; color?: string } {
  if (tone === 'dim') {
    return { dimColor: true }
  }

  return tone === 'plain' ? {} : { color: TONE_COLOR[tone] }
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
    await refresh($, tracker, e)

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
    const pieces = fitLine(current, e.props.bodyColumns)

    return (
      <Box key="context-status">
        {pieces.map((piece, index) => (
          <Text key={`p${index}`} wrap="truncate" {...toneProps(piece.tone)}>
            {piece.text}
          </Text>
        ))}
      </Box>
    )
  })
}
