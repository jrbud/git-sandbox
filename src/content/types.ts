import type { Predicate } from '../engine/predicates'
import type { World } from '../engine/types'

export interface CheatsheetEntry {
  command: string
  description: string
  example: string
}

/**
 * One playable level (spec Section 6), as used at runtime. In the JSON files the starting
 * state is a RepoSnapshot recipe (see snapshot.ts); the loader builds it into a World.
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

/** A concept groups its main level (first) with its variation levels. */
export interface Concept {
  id: string
  sectionId: string
  title: string
  /** The main level followed by the variations, in play order. */
  levels: Level[]
}

export type SectionUnlock = { type: 'none' } | { type: 'section-complete'; sectionId: string }

export interface Section {
  id: string
  title: string
  description: string
  icon: string
  /** Concepts in play order; each one's main level unlocks the next concept. */
  conceptIds: string[]
  unlock: SectionUnlock
}

/** Everything loaded from the content files. */
export interface ContentCatalog {
  sections: Section[]
  concepts: Map<string, Concept>
  levels: Map<string, Level>
}

export function mainLevel(concept: Concept): Level {
  return concept.levels[0]
}

export function variations(concept: Concept): Level[] {
  return concept.levels.slice(1)
}
