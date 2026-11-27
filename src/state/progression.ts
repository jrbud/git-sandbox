import {
  mainLevel,
  variations,
  type Concept,
  type ContentCatalog,
  type Level,
  type Section,
} from '../content/types'
import { isLevelComplete, type Progress } from './progress'

export type Mastery = 'not-started' | 'in-progress' | 'mastered' | 'mastered-with-assistance'

export const MASTERY_LABELS: Record<Mastery, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  mastered: 'Mastered',
  'mastered-with-assistance': 'Mastered (with assistance)',
}

/**
 * Spec Section 6: a concept is mastered once every variation is complete; "Mastered" if no
 * hints were used on any of them, otherwise "Mastered (with assistance)". The main level
 * alone never grants mastery.
 */
export function conceptMastery(concept: Concept, progress: Progress): Mastery {
  const practice = variations(concept)
  const done = (level: Level) => isLevelComplete(progress, level.id)
  if (practice.length > 0 && practice.every(done)) {
    return practice.some((level) => progress.levels[level.id].hintUsed)
      ? 'mastered-with-assistance'
      : 'mastered'
  }
  return concept.levels.some(done) ? 'in-progress' : 'not-started'
}

function conceptsOf(section: Section, catalog: ContentCatalog): Concept[] {
  return section.conceptIds.map((id) => catalog.concepts.get(id)!)
}

export function isSectionComplete(
  section: Section,
  catalog: ContentCatalog,
  progress: Progress,
): boolean {
  return conceptsOf(section, catalog).every((concept) =>
    isLevelComplete(progress, mainLevel(concept).id),
  )
}

export function isSectionUnlocked(
  section: Section,
  catalog: ContentCatalog,
  progress: Progress,
): boolean {
  if (section.unlock.type === 'none') return true
  const required = catalog.sections.find(
    (s) => s.id === (section.unlock as { sectionId: string }).sectionId,
  )
  return required !== undefined && isSectionComplete(required, catalog, progress)
}

/** A concept unlocks when the previous concept's main level is complete. */
export function isConceptUnlocked(
  concept: Concept,
  catalog: ContentCatalog,
  progress: Progress,
): boolean {
  const section = catalog.sections.find((s) => s.id === concept.sectionId)!
  if (!isSectionUnlocked(section, catalog, progress)) return false
  const index = section.conceptIds.indexOf(concept.id)
  if (index <= 0) return true
  const previous = catalog.concepts.get(section.conceptIds[index - 1])!
  return isLevelComplete(progress, mainLevel(previous).id)
}

/** Main levels are open once their concept is; variations open after the main level is done. */
export function isLevelUnlocked(
  level: Level,
  catalog: ContentCatalog,
  progress: Progress,
): boolean {
  const concept = catalog.concepts.get(level.conceptId)!
  if (!isConceptUnlocked(concept, catalog, progress)) return false
  return level.kind === 'main' || isLevelComplete(progress, mainLevel(concept).id)
}

/** Section progress counts main levels only (spec Section 7). */
export function sectionProgress(section: Section, catalog: ContentCatalog, progress: Progress) {
  const mains = conceptsOf(section, catalog).map(mainLevel)
  return {
    completed: mains.filter((level) => isLevelComplete(progress, level.id)).length,
    total: mains.length,
  }
}

/**
 * Where "Next level" goes after finishing a level: the next unfinished variation of the same
 * concept after a variation, otherwise the next concept's main level, otherwise nothing.
 */
export function nextLevel(
  level: Level,
  catalog: ContentCatalog,
  progress: Progress,
): Level | undefined {
  const concept = catalog.concepts.get(level.conceptId)!
  if (level.kind === 'variation') {
    const next = variations(concept).find(
      (v) => v.id !== level.id && !isLevelComplete(progress, v.id),
    )
    if (next) return next
  }
  const ordered = catalog.sections.flatMap((s) => s.conceptIds)
  for (const id of ordered.slice(ordered.indexOf(concept.id) + 1)) {
    const candidate = mainLevel(catalog.concepts.get(id)!)
    if (isLevelUnlocked(candidate, catalog, progress)) return candidate
  }
  return undefined
}
