import { describe, expect, it } from 'vitest'
import { getCatalog } from '../../src/content/catalog'
import objectivesJson from '../../src/content/conceptObjectives.json'
import { mainLevel, variations, type Level } from '../../src/content/types'
import { runCommand } from '../../src/engine/dispatcher'
import { evaluatePredicate } from '../../src/engine/predicates'
import { cloneWorld } from '../../src/engine/repo'

const catalog = getCatalog()
const coreBasics = catalog.sections.find((s) => s.id === 'core-basics')!
const concepts = coreBasics.conceptIds.map((id) => catalog.concepts.get(id)!)
const allLevels = concepts.flatMap((c) => c.levels)

/** The Section 9 MVP concept list (checkout/switch is one concept). */
const MVP_CONCEPTS = [
  'init',
  'add',
  'commit',
  'status',
  'log',
  'diff',
  'branch',
  'switch',
  'merge',
  'clone',
  'remote',
  'push',
  'pull',
  'fetch',
  'gitignore',
  'config',
]

function play(level: Level) {
  let world = cloneWorld(level.startingState)
  for (const input of level.solution) {
    const result = runCommand(world, input, { allowedCommands: level.allowedCommands })
    if (!result.ok) {
      throw new Error(`${level.id}: "${input}" failed: ${result.error.message}`)
    }
    world = result.world
  }
  return world
}

// Phase 4 step 1 and 4: learning objectives and coverage.
describe('Core Basics coverage', () => {
  const objectives = objectivesJson['core-basics']

  it('covers every Core Basics concept from the MVP scope', () => {
    expect([...coreBasics.conceptIds].sort()).toEqual([...MVP_CONCEPTS].sort())
  })

  it('maps every learning objective to at least one concept with authored levels', () => {
    expect(objectives).toHaveLength(7)
    for (const objective of objectives) {
      expect(objective.concepts.length, objective.id).toBeGreaterThan(0)
      for (const id of objective.concepts) {
        expect(catalog.concepts.get(id)?.levels.length, `${objective.id} -> ${id}`).toBeGreaterThan(
          0,
        )
      }
    }
  })

  it('maps every concept to exactly one learning objective', () => {
    for (const concept of concepts) {
      const owners = objectives.filter((o) => o.concepts.includes(concept.id)).map((o) => o.id)
      expect(owners, concept.id).toHaveLength(1)
    }
  })
})

// Phase 4 steps 2 and 3: every main level and variation is solvable.
describe('Core Basics levels', () => {
  it('gives every concept one lesson and three practice levels', () => {
    for (const concept of concepts) {
      expect(mainLevel(concept).kind, concept.id).toBe('main')
      expect(variations(concept), concept.id).toHaveLength(3)
    }
    expect(allLevels).toHaveLength(64)
  })

  it.each(allLevels.map((level) => [level.id, level] as const))(
    '%s is not solved at the start, and its solution solves it within its allowed commands',
    (_, level) => {
      expect(evaluatePredicate(level.startingState, level.successPredicate)).toBe(false)
      expect(evaluatePredicate(play(level), level.successPredicate)).toBe(true)
    },
  )

  it('has variations that only use commands their lesson allows', () => {
    for (const concept of concepts) {
      const allowed = new Set(mainLevel(concept).allowedCommands)
      for (const level of variations(concept)) {
        const extra = level.allowedCommands.filter((entry) => !allowed.has(entry))
        expect(extra, level.id).toEqual([])
      }
    }
  })

  it('gives lessons a briefing and cheatsheet, practice levels neither, and every level hints', () => {
    for (const level of allLevels) {
      expect(level.hints.length, level.id).toBeGreaterThanOrEqual(3)
      expect(level.successMessage, level.id).toBeTruthy()
      if (level.kind === 'main') {
        expect(level.briefing, level.id).not.toBe('')
        expect(level.cheatsheet.length, level.id).toBeGreaterThan(0)
      } else {
        expect(level.cheatsheet, level.id).toEqual([])
      }
    }
  })

  it('uses unique, predictable level ids', () => {
    for (const concept of concepts) {
      expect(concept.levels.map((l) => l.id)).toEqual([
        `core.${concept.id}.main`,
        `core.${concept.id}.var1`,
        `core.${concept.id}.var2`,
        `core.${concept.id}.var3`,
      ])
    }
  })
})
