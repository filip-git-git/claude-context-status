// Composes the band's one line from the snapshot and shortens it to the width it is drawn in.
import { describeStatus, formatHead, usageLevel } from './format-status'
import type { StatusLevel } from './format-status'
import { describeLimits } from './rate-limits'
import type { LimitSegment } from './rate-limits'
import type { StatusSnapshot } from '../types'

// How a piece is drawn: dimmed, plain, or in the color of a usage level.
export type Tone = 'dim' | 'plain' | StatusLevel

export type Piece = { text: string; tone: Tone }

// What a line shows beyond model, context bar and percentages.
export type Detail = { tokens: boolean; resets: boolean; limitBars: boolean }

// Fullest first; each drops one more detail (FR-15).
const DETAILS: readonly Detail[] = [
  { tokens: true, resets: true, limitBars: true },
  { tokens: false, resets: true, limitBars: true },
  { tokens: false, resets: false, limitBars: true },
  { tokens: false, resets: false, limitBars: false },
]

const MINUTE_MS = 60_000

function usageTone(level: StatusLevel): Tone {
  return level === 'ok' ? 'plain' : level
}

function contextPieces(snapshot: StatusSnapshot, detail: Detail): Piece[] {
  const parts = describeStatus(snapshot.model, snapshot.context, snapshot.effort)
  const pieces: Piece[] = [{ text: `${formatHead(parts)}ctx `, tone: 'dim' }]
  if (parts.bar !== '') {
    pieces.push({ text: `${parts.bar} `, tone: parts.level })
  }
  const usage = detail.tokens ? `${parts.percentText} · ${parts.tokensText}` : parts.percentText
  pieces.push({ text: `${usage}${parts.note}`, tone: usageTone(parts.level) })

  return pieces
}

function limitPieces(segment: LimitSegment, detail: Detail): Piece[] {
  const level = usageLevel(segment.percent)
  const pieces: Piece[] = [{ text: ` │ ${segment.label} `, tone: 'dim' }]
  if (detail.limitBars) {
    pieces.push({ text: `${segment.bar} `, tone: level })
  }
  pieces.push({ text: segment.percentText, tone: usageTone(level) })
  if (detail.resets && segment.reset !== '') {
    pieces.push({ text: ` ${segment.reset}`, tone: 'dim' })
  }

  return pieces
}

export function buildLine(snapshot: StatusSnapshot, detail: Detail): Piece[] {
  const nowMs = (snapshot.minute ?? 0) * MINUTE_MS
  const limits = describeLimits(snapshot.limits, nowMs)

  return [...contextPieces(snapshot, detail), ...limits.flatMap(segment => limitPieces(segment, detail))]
}

export function lineText(pieces: readonly Piece[]): string {
  return pieces.map(piece => piece.text).join('')
}

// The fullest line that fits in `columns`; the barest one when none does.
export function fitLine(snapshot: StatusSnapshot, columns: number): Piece[] {
  let line: Piece[] = []
  for (const detail of DETAILS) {
    line = buildLine(snapshot, detail)
    if (lineText(line).length <= columns) {
      return line
    }
  }

  return line
}
