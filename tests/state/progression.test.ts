import { describe, expect, it } from 'vitest'
import { emptyProgress, recordCompletion, type Progress } from '../../src/state/progress'
import {
  conceptMastery,
  isConceptUnlocked,
  isLevelUnlocked,
  isSectionUnlocked,
  nextLevel,
  sectionProgress,
} from '../../src/state/progression'
import { makeCatalog } from '../fixtures/catalog'

const catalog = makeCatalog()
const concept = (id: string) => catalog.concepts.get(id)!
const level = (id: string) => catalog.levels.get(id)!
const section = (id: string) => catalog.sections.find((s) => s.id === id)!

function complete(progress: Progress, ids: string[], hintUsed = false): Progress {
  return ids.reduce((p, id) => recordCompletion(p, id, { hintUsed }), progress)
}

// Phase 3 step 2: mastery tracking per concept.
describe('conceptMastery', () => {
  it('is "not started" with nothing done and "in progress" after the main level', () => {
    expect(conceptMastery(concept('alpha'), emptyProgress())).toBe('not-started')
    expect(conceptMastery(concept('alpha'), complete(emptyProgress(), ['alpha.main']))).toBe(
      'in-progress',
    )
  })

  it('stays "in progress" until every variation is complete', () => {
    const p = complete(emptyProgress(), ['alpha.main', 'alpha.var1'])
    expect(conceptMastery(concept('alpha'), p)).toBe('in-progress')
  })

  it('is "Mastered" when all variations are done with no hints', () => {
    const p = complete(emptyProgress(), ['alpha.main', 'alpha.var1', 'alpha.var2'])
    expect(conceptMastery(concept('alpha'), p)).toBe('mastered')
  })

  it('is "Mastered (with assistance)" when any variation used a hint', () => {
    let p = complete(emptyProgress(), ['alpha.main', 'alpha.var1'])
    p = complete(p, ['alpha.var2'], true)
    expect(conceptMastery(concept('alpha'), p)).toBe('mastered-with-assistance')
  })

  it('ignores hints used on the main level, and needs no main level once variations are done', () => {
    let p = complete(emptyProgress(), ['alpha.main'], true)
    p = complete(p, ['alpha.var1', 'alpha.var2'])
    expect(conceptMastery(concept('alpha'), p)).toBe('mastered')
  })
})

describe('unlocking and progress', () => {
  it('unlocks each concept when the previous main level is complete', () => {
    const start = emptyProgress()
    expect(isConceptUnlocked(concept('alpha'), catalog, start)).toBe(true)
    expect(isConceptUnlocked(concept('beta'), catalog, start)).toBe(false)
    const p = complete(start, ['alpha.main'])
    expect(isConceptUnlocked(concept('beta'), catalog, p)).toBe(true)
    expect(isConceptUnlocked(concept('gamma'), catalog, p)).toBe(false)
  })

  it('opens variations only after their main level', () => {
    expect(isLevelUnlocked(level('alpha.main'), catalog, emptyProgress())).toBe(true)
    expect(isLevelUnlocked(level('alpha.var1'), catalog, emptyProgress())).toBe(false)
    expect(
      isLevelUnlocked(level('alpha.var1'), catalog, complete(emptyProgress(), ['alpha.main'])),
    ).toBe(true)
  })

  it('unlocks the next section when every main level of the previous one is done', () => {
    const almost = complete(emptyProgress(), ['alpha.main', 'beta.main'])
    expect(isSectionUnlocked(section('collab'), catalog, almost)).toBe(false)
    expect(isConceptUnlocked(concept('delta'), catalog, almost)).toBe(false)
    const done = complete(almost, ['gamma.main'])
    expect(isSectionUnlocked(section('collab'), catalog, done)).toBe(true)
  })

  it('counts only main levels toward section progress', () => {
    const p = complete(emptyProgress(), ['alpha.main', 'alpha.var1', 'alpha.var2', 'beta.main'])
    expect(sectionProgress(section('basics'), catalog, p)).toEqual({ completed: 2, total: 3 })
  })

  it('picks the next level: remaining variations, then the next concept', () => {
    const p = complete(emptyProgress(), ['alpha.main', 'alpha.var1'])
    expect(nextLevel(level('alpha.var1'), catalog, p)?.id).toBe('alpha.var2')
    expect(nextLevel(level('alpha.main'), catalog, p)?.id).toBe('beta.main')
    const end = complete(emptyProgress(), ['alpha.main', 'beta.main', 'gamma.main', 'delta.main'])
    expect(nextLevel(level('delta.main'), catalog, end)).toBeUndefined()
  })
})
