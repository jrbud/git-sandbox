import type { Concept, ContentCatalog, Level, Section } from '../../src/content/types'
import { createSampleLevel } from './sampleLevel'

function level(conceptId: string, sectionId: string, kind: Level['kind'], index = 0): Level {
  const base = createSampleLevel()
  return {
    ...base,
    id: kind === 'main' ? `${conceptId}.main` : `${conceptId}.var${index}`,
    sectionId,
    conceptId,
    kind,
    title: kind === 'main' ? `${conceptId} main` : `${conceptId} practice ${index}`,
    cheatsheet: kind === 'main' ? base.cheatsheet : [],
  }
}

function concept(id: string, sectionId: string, variationCount = 2): Concept {
  return {
    id,
    sectionId,
    title: id[0].toUpperCase() + id.slice(1),
    summary: `What ${id} does.`,
    levels: [
      level(id, sectionId, 'main'),
      ...Array.from({ length: variationCount }, (_, i) => level(id, sectionId, 'variation', i + 1)),
    ],
  }
}

/**
 * Two sections: "basics" (alpha, beta, gamma) and "collab" (delta), which unlocks once every
 * basics main level is done. Every level is the sample level: write notes.txt and commit it.
 */
export function makeCatalog(): ContentCatalog {
  const concepts = [
    concept('alpha', 'basics'),
    concept('beta', 'basics'),
    concept('gamma', 'basics'),
    concept('delta', 'collab', 1),
  ]
  const sections: Section[] = [
    {
      id: 'basics',
      title: 'Basics',
      description: 'The first steps.',
      conceptIds: ['alpha', 'beta', 'gamma'],
      unlock: { type: 'none' },
    },
    {
      id: 'collab',
      title: 'Collaboration',
      description: 'Working with others.',
      conceptIds: ['delta'],
      unlock: { type: 'section-complete', sectionId: 'basics' },
    },
  ]
  return {
    sections,
    concepts: new Map(concepts.map((c) => [c.id, c])),
    levels: new Map(concepts.flatMap((c) => c.levels).map((l) => [l.id, l])),
  }
}

/** The commands that solve every fixture level. */
export const SOLUTION = [
  'echo "notes" > notes.txt',
  'git add notes.txt',
  'git commit -m "Add notes"',
]
