import type { Predicate } from '../engine/predicates'
import type { World } from '../engine/types'

export interface CheatsheetEntry {
  command: string
  description: string
  example: string
}

/**
 * One playable level (spec Section 6). Phase 3 adds loading these from JSON files; until
 * then `startingState` is an in-memory World.
 */
export interface Level {
  id: string
  sectionId: string
  conceptId: string
  kind: 'main' | 'variation'
  title: string
  /** Plain-language explanation of the concept (main levels). */
  briefing: string
  /** Player-facing goal text. */
  objective: string
  /** Only main levels have a cheatsheet. */
  cheatsheet: CheatsheetEntry[]
  allowedCommands: string[]
  startingState: World
  successPredicate: Predicate
  /** Ordered from vague to exact. */
  hints: string[]
  /** Shown on success: why what the player did worked. */
  successMessage?: string
}
