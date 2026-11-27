import { describe, expect, it } from 'vitest'
import { createDemoCatalog, createDemoProgress } from '../../src/dev/demoSeed'
import { conceptMastery, isConceptUnlocked } from '../../src/state/progression'

describe('demo seed', () => {
  it('covers every map state', () => {
    const catalog = createDemoCatalog()
    const progress = createDemoProgress()
    const mastery = (id: string) => conceptMastery(catalog.concepts.get(id)!, progress)
    expect(mastery('demo-init')).toBe('mastered')
    expect(mastery('demo-add')).toBe('mastered-with-assistance')
    expect(mastery('demo-commit')).toBe('in-progress')
    expect(mastery('demo-diff')).toBe('not-started')
    expect(isConceptUnlocked(catalog.concepts.get('demo-diff')!, catalog, progress)).toBe(true)
    expect(isConceptUnlocked(catalog.concepts.get('demo-branch')!, catalog, progress)).toBe(false)
  })
})
