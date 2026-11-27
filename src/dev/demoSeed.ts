import { getCatalog } from '../content/catalog'
import type { Concept, ContentCatalog, Level, Section } from '../content/types'
import { recordCompletion, emptyProgress, type Progress } from '../state/progress'

/**
 * Development-only demo data (open the app with ?demo): a map with many concepts in every
 * state, so the level-select screen can be reviewed before real content exists. Every demo
 * level reuses the placeholder "Commits" levels under a different name. Progress lives in
 * memory, so the player's real saved progress is never touched.
 */

/** Short summaries for the demo concepts, as real content files will have. */
const SUMMARIES: Record<string, string> = {
  Init: 'Turns a folder into a git repository, so git can start tracking it.',
  Add: 'Stages changes, choosing exactly what goes into the next commit.',
  Commit: 'Saves a snapshot of your staged files, with a message describing it.',
  Status: 'Shows which files are changed, staged or untracked.',
  Log: 'Lists the history of commits, newest first.',
  Diff: 'Shows exactly which lines changed.',
  Branch: 'Creates a separate line of work you can change without touching main.',
  Switch: 'Moves you between branches.',
  Merge: 'Combines the work from one branch into another.',
  Clone: 'Copies a remote repository, with its whole history, onto your machine.',
  Push: 'Uploads your commits to a remote.',
  Pull: 'Downloads new commits from a remote and merges them in.',
}

const SECTIONS: Array<{ section: Omit<Section, 'conceptIds'>; concepts: string[] }> = [
  {
    section: {
      id: 'demo-basics',
      title: 'Core Basics',
      description: 'Commits, branches and remotes.',
      unlock: { type: 'none' },
    },
    concepts: ['Init', 'Add', 'Commit', 'Status', 'Log', 'Diff', 'Branch', 'Switch', 'Merge'],
  },
  {
    section: {
      id: 'demo-remotes',
      title: 'Collaboration',
      description: 'Working with others.',
      unlock: { type: 'section-complete', sectionId: 'demo-basics' },
    },
    concepts: ['Clone', 'Push', 'Pull'],
  },
]

function demoLevels(source: Level[], conceptId: string, sectionId: string, title: string): Level[] {
  const [main, practice] = source
  return [
    { ...main, id: `${conceptId}.main`, conceptId, sectionId, title: `${title}: the basics` },
    ...[1, 2, 3].map((n) => ({
      ...practice,
      id: `${conceptId}.var${n}`,
      conceptId,
      sectionId,
      title: `${title} practice ${n}`,
    })),
  ]
}

export function createDemoCatalog(): ContentCatalog {
  const source = getCatalog().concepts.values().next().value!.levels
  const sections: Section[] = []
  const concepts = new Map<string, Concept>()
  for (const { section, concepts: titles } of SECTIONS) {
    const ids = titles.map((title) => `demo-${title.toLowerCase()}`)
    sections.push({ ...section, conceptIds: ids })
    titles.forEach((title, i) => {
      concepts.set(ids[i], {
        id: ids[i],
        sectionId: section.id,
        title,
        summary: SUMMARIES[title],
        levels: demoLevels(source, ids[i], section.id, title),
      })
    })
  }
  const levels = new Map([...concepts.values()].flatMap((c) => c.levels).map((l) => [l.id, l]))
  return { sections, concepts, levels }
}

/**
 * Init mastered, Add mastered with hints, Commit part-practised, Status and Log with only the
 * lesson done, Diff open but not started, everything after it locked.
 */
export function createDemoProgress(): Progress {
  const done =
    (ids: string[], hintUsed = false) =>
    (p: Progress) =>
      ids.reduce((acc, id) => recordCompletion(acc, id, { hintUsed }), p)
  const steps = [
    done(['demo-init.main', 'demo-init.var1', 'demo-init.var2', 'demo-init.var3']),
    done(['demo-add.main', 'demo-add.var1', 'demo-add.var3']),
    done(['demo-add.var2'], true),
    done(['demo-commit.main', 'demo-commit.var1']),
    done(['demo-status.main', 'demo-log.main']),
  ]
  return steps.reduce((p, step) => step(p), emptyProgress())
}
