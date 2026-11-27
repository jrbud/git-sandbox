import { describe, expect, it } from 'vitest'
import { getCatalog } from '../../src/content/catalog'
import { ContentError, loadContent } from '../../src/content/loader'
import { buildWorld } from '../../src/content/snapshot'
import { headCommitId } from '../../src/engine/repo'

const sections = {
  sections: [
    {
      id: 'core-basics',
      title: 'Core Basics',
      description: 'Basics.',
      icon: '🌱',
      concepts: ['commit'],
      unlock: { type: 'none' },
    },
  ],
}

const main = {
  id: 'core.commit.main',
  kind: 'main',
  title: 'First commit',
  briefing: 'A commit is a snapshot.',
  objective: 'Commit notes.txt.',
  cheatsheet: [{ command: 'git add', description: 'Stage', example: 'git add a.txt' }],
  allowedCommands: ['git add', 'git commit -m'],
  startingState: { setup: ['git init'] },
  successPredicate: { check: 'fileCommitted', path: 'notes.txt' },
  hints: ['Stage it, then commit.'],
}

const variation = {
  ...main,
  id: 'core.commit.var1',
  kind: 'variation',
  title: 'Again',
  cheatsheet: undefined,
}

const commitFile = {
  conceptId: 'commit',
  sectionId: 'core-basics',
  title: 'Commits',
  levels: [main, variation],
}
const files = (file: unknown = commitFile) => ({ './levels/core-basics/commit.json': file })

function problems(sectionsJson: unknown, conceptFiles: Record<string, unknown>): string[] {
  try {
    loadContent(sectionsJson, conceptFiles)
  } catch (error) {
    if (error instanceof ContentError) return error.problems
    throw error
  }
  throw new Error('Expected the content to be rejected')
}

// Phase 3 step 3: loading sections.json and the per-concept level files.
describe('loadContent', () => {
  it('loads a sample manifest into sections, concepts and levels', () => {
    const catalog = loadContent(sections, files())
    expect(catalog.sections).toEqual([
      {
        id: 'core-basics',
        title: 'Core Basics',
        description: 'Basics.',
        icon: '🌱',
        conceptIds: ['commit'],
        unlock: { type: 'none' },
      },
    ])
    const concept = catalog.concepts.get('commit')!
    expect(concept.levels.map((l) => l.id)).toEqual(['core.commit.main', 'core.commit.var1'])
    const level = catalog.levels.get('core.commit.var1')!
    expect(level).toMatchObject({
      sectionId: 'core-basics',
      conceptId: 'commit',
      kind: 'variation',
      cheatsheet: [],
    })
    expect(level.startingState.repo.initialized).toBe(true)
  })

  it('fails loudly, naming the file and field, for malformed levels', () => {
    const broken = { ...commitFile, levels: [{ ...main, objective: 42, hints: [] }, variation] }
    expect(problems(sections, files(broken))).toEqual([
      'levels/core-basics/commit.json: level "core.commit.main": "objective" must be a non-empty string',
      'levels/core-basics/commit.json: level "core.commit.main": "hints" must be a non-empty array of strings',
    ])
  })

  it('rejects unknown predicate checks and commands the engine does not support', () => {
    const broken = {
      ...commitFile,
      levels: [
        { ...main, successPredicate: { check: 'magic' }, allowedCommands: ['git rebase'] },
        variation,
      ],
    }
    const found = problems(sections, files(broken))
    expect(found.some((p) => p.includes('allowedCommands entry "git rebase"'))).toBe(true)
    expect(found.some((p) => p.includes('successPredicate.check must be one of'))).toBe(true)
  })

  it('rejects setup commands that fail, and objectives already met at the start', () => {
    const badSetup = {
      ...commitFile,
      levels: [{ ...main, startingState: { setup: ['git commit -m "x"'] } }, variation],
    }
    expect(problems(sections, files(badSetup))[0]).toMatch(
      /startingState could not be built: Setup command "git commit -m "x"" failed/,
    )
    const alreadyDone = {
      ...commitFile,
      levels: [{ ...main, successPredicate: { check: 'isInitialized' } }, variation],
    }
    expect(problems(sections, files(alreadyDone))).toEqual([
      'levels/core-basics/commit.json: level "core.commit.main": the objective is already met by the starting state',
    ])
  })

  it('checks the main/variation structure and cheatsheet rules', () => {
    const variationFirst = { ...commitFile, levels: [variation, main] }
    expect(problems(sections, files(variationFirst))).toContain(
      'levels/core-basics/commit.json: the first level must be the only "main" level; the rest are variations',
    )
    const cheatyVariation = {
      ...commitFile,
      levels: [main, { ...variation, cheatsheet: main.cheatsheet }],
    }
    expect(problems(sections, files(cheatyVariation))).toContain(
      'levels/core-basics/commit.json: level "core.commit.var1": variation levels must not have a cheatsheet',
    )
  })

  it('cross-checks the manifest against the files', () => {
    const extraConcept = {
      ...sections,
      sections: [{ ...sections.sections[0], concepts: ['commit', 'branch'] }],
    }
    expect(problems(extraConcept, files())).toContain(
      'sections.json: section "core-basics" lists concept "branch", but levels/core-basics/branch.json does not exist',
    )
    const unlisted = {
      ...files(),
      './levels/core-basics/log.json': {
        ...commitFile,
        conceptId: 'log',
        levels: [{ ...main, id: 'log.main' }],
      },
    }
    expect(problems(sections, unlisted)).toContain(
      'levels/core-basics/log.json: concept "log" is not listed in sections.json',
    )
    expect(problems({ sections: 'nope' }, files())).toContain(
      'sections.json: must be an object with a "sections" array',
    )
    const mismatched = { ...commitFile, conceptId: 'commits' }
    expect(problems(sections, files(mismatched))).toContain(
      'levels/core-basics/commit.json: "conceptId" must be "commit" to match the file name',
    )
  })

  it('rejects duplicate level ids', () => {
    const dup = { ...commitFile, levels: [main, { ...variation, id: main.id }] }
    expect(problems(sections, files(dup))).toContain(
      'levels/core-basics/commit.json: level id "core.commit.main" is used twice',
    )
  })
})

describe('buildWorld', () => {
  it('builds remotes and teammate activity from setup steps', () => {
    const url = 'https://example.com/team/app.git'
    const world = buildWorld({
      servers: [url],
      setup: [
        {
          workspace: 'teammate',
          commands: [
            'git init',
            'echo a > a.txt',
            'git add .',
            'git commit -m "Start"',
            `git remote add origin ${url}`,
            'git push -u origin main',
          ],
        },
        `git clone ${url}`,
        {
          workspace: 'teammate',
          commands: ['echo b > b.txt', 'git add .', 'git commit -m "More"', 'git push'],
        },
      ],
    })
    expect(world.repo.workingDirectory.get('a.txt')).toBe('a\n')
    expect(world.servers.get(url)!.branches.get('main')).not.toBe(headCommitId(world.repo))
    const teammateCommit = world.servers
      .get(url)!
      .commits.get(world.servers.get(url)!.branches.get('main')!)!
    expect(teammateCommit.author).toEqual({ name: 'Teammate', email: 'teammate@example.com' })
  })

  it('defaults to a ready-made identity, or none when globalConfig is {}', () => {
    expect(buildWorld().globalConfig.get('user.name')).toBe('Player')
    expect(buildWorld({ globalConfig: {} }).globalConfig.size).toBe(0)
  })
})

describe('the real content files', () => {
  it('load without errors', () => {
    const catalog = getCatalog()
    expect(catalog.sections.length).toBeGreaterThan(0)
    expect(catalog.levels.size).toBeGreaterThan(0)
  })
})
