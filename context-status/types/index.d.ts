// State contract: the last model, effort and context figures the band draws.
export type ContextFigures = { tokens?: number; window: number; percent?: number }

export type StatusSnapshot = { model: string; effort?: string | number; context: ContextFigures }

declare module 'claude-code' {
  interface PluginState {
    'context-status': { snapshot: StatusSnapshot | null }
  }
}
