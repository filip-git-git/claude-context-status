// Works out which reasoning effort to show: the last main-loop request's, or the settings' value.

export type EffortValue = string | number

// What the mod has seen of the effort so far.
export type EffortTracker = {
  // The effort the last main-loop model request was sent with.
  fromTurn?: EffortValue
  // The settings' value at the previous read, to tell when it changed.
  lastSettings?: EffortValue
  // The model the last read was for, to tell when it changed.
  lastModel?: string
}

function asEffort(value: unknown): EffortValue | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

// modelSettings["<model id>"].effortLevel wins over the top-level effortLevel.
export function effortFromSettings(settings: Readonly<Record<string, unknown>>, model: string): EffortValue | undefined {
  const perModel = settings['modelSettings']
  if (typeof perModel === 'object' && perModel !== null) {
    const entry = (perModel as Record<string, unknown>)[model]
    if (typeof entry === 'object' && entry !== null) {
      const level = asEffort((entry as Record<string, unknown>)['effortLevel'])
      if (level !== undefined) {
        return level
      }
    }
  }

  return asEffort(settings['effortLevel'])
}

// A turn's value is the truth until the settings or the model change; then the settings speak until the next turn.
export function pickEffort(tracker: EffortTracker, settingsEffort: EffortValue | undefined, model: string): EffortValue | undefined {
  if (settingsEffort !== tracker.lastSettings || model !== tracker.lastModel) {
    if (tracker.lastModel !== undefined) {
      tracker.fromTurn = undefined
    }
    tracker.lastSettings = settingsEffort
    tracker.lastModel = model
  }

  return tracker.fromTurn ?? settingsEffort
}
