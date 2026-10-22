// State contract: the last model, effort, context and rate-limit figures the band draws.
export type ContextFigures = { tokens?: number; window: number; percent?: number }

// One rate-limit window: percent used (0-100) and when it resets (ISO 8601).
export type LimitWindow = { percent: number; resetsAt?: string }

export type LimitFigures = { fiveHour?: LimitWindow; sevenDay?: LimitWindow }

export type StatusSnapshot = {
  model: string
  effort?: string | number
  context: ContextFigures
  // Absent in a snapshot an earlier version of the mod stored.
  limits?: LimitFigures
  // Minutes since the epoch the countdowns are measured from; 0 when nothing counts down.
  minute?: number
}

declare module 'claude-code' {
  interface PluginState {
    'context-status': { snapshot: StatusSnapshot | null }
  }
}
