// Keeps the plugin's status line showing the main-loop model and context window fill.
import type { EngineInterface, Register, Timer } from 'claude-code'

import { formatStatus } from './format-status'
import type { ContextFigures } from './format-status'

// /model has no mod event, so a cheap poll catches a switch between turns.
const POLL_MS = 5000

type Painted = { text?: string; poll?: Timer }

// Reads model and usage (both free calls) and repaints only when the text changed.
async function refresh($: EngineInterface, painted: Painted, measured?: ContextFigures): Promise<void> {
  try {
    const model = await $.session.model()
    const context = measured ?? (await $.session.usage()).context
    const text = formatStatus(model, context)
    if (text !== painted.text) {
      painted.text = text
      $.ui.status(text)
    }
  } catch {
    // Keep the last known line; a failed read must never break the session.
  }
}

export const register: Register = on => {
  const painted: Painted = {}

  on('session.start', async ($, e, next) => {
    painted.text = undefined
    await refresh($, painted)
    painted.poll?.cancel()
    painted.poll = $.clock.every(POLL_MS, () => void refresh($, painted))

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await refresh($, painted, e.context)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($, painted)

    return result
  })
}
