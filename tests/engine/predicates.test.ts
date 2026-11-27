import { describe, expect, it } from 'vitest'
import { runCommands } from '../../src/engine/dispatcher'
import { evaluatePredicate, type Predicate } from '../../src/engine/predicates'
import type { World } from '../../src/engine/types'
import { freshWorld, write } from './helpers'
import { URL, worldWithServer } from './remoteHelpers'

function state(commands: string[], start: World = freshWorld()): World {
  const result = runCommands(start, commands)
  if (!result.ok) throw new Error(result.error.message)
  return result.world
}

const twoCommitsOnFeature = () =>
  state(
    [
      'git init',
      'git add a.txt',
      'git commit -m "First"',
      'git checkout -b feature',
      'git add b.txt',
      'git commit -m "Add b"',
    ],
    write(freshWorld(), { 'a.txt': 'a\n', 'b.txt': 'b\n' }),
  )

function check(world: World, predicate: Predicate): boolean {
  return evaluatePredicate(world, predicate)
}

// Step 20: the declarative predicate evaluator.
describe('evaluatePredicate', () => {
  const world = twoCommitsOnFeature()
  const empty = freshWorld()

  it('isInitialized', () => {
    expect(check(world, { check: 'isInitialized' })).toBe(true)
    expect(check(empty, { check: 'isInitialized' })).toBe(false)
  })

  it('branchExists', () => {
    expect(check(world, { check: 'branchExists', name: 'feature' })).toBe(true)
    expect(check(world, { check: 'branchExists', name: 'nope' })).toBe(false)
  })

  it('headPointsTo and headDetached', () => {
    expect(check(world, { check: 'headPointsTo', ref: 'feature' })).toBe(true)
    expect(check(world, { check: 'headPointsTo', ref: 'main' })).toBe(false)
    expect(check(world, { check: 'headDetached' })).toBe(false)
    expect(check(state(['git checkout HEAD~1'], world), { check: 'headDetached' })).toBe(true)
  })

  it('commitCount with min, max and equals', () => {
    expect(check(world, { check: 'commitCount', onBranch: 'main', equals: 1 })).toBe(true)
    expect(check(world, { check: 'commitCount', min: 2 })).toBe(true)
    expect(check(world, { check: 'commitCount', onBranch: 'main', min: 2 })).toBe(false)
    expect(check(world, { check: 'commitCount', max: 1 })).toBe(false)
    expect(check(empty, { check: 'commitCount', equals: 0 })).toBe(true)
  })

  it('file checks: working directory, staged, tracked, untracked, ignored, committed', () => {
    const files = state(
      ['git init'],
      write(freshWorld(), { 'a.txt': 'a\n', '.gitignore': '*.log\n', 'app.log': 'x' }),
    )
    const staged = state(['git add a.txt'], files)
    expect(check(files, { check: 'fileInWorkingDirectory', path: 'a.txt', content: 'a\n' })).toBe(
      true,
    )
    expect(check(files, { check: 'fileUntracked', path: 'a.txt' })).toBe(true)
    expect(check(files, { check: 'fileUntracked', path: 'app.log' })).toBe(false)
    expect(check(files, { check: 'fileIgnored', path: 'app.log' })).toBe(true)
    expect(check(files, { check: 'fileStaged', path: 'a.txt' })).toBe(false)
    expect(check(staged, { check: 'fileStaged', path: 'a.txt' })).toBe(true)
    expect(check(staged, { check: 'fileTracked', path: 'a.txt' })).toBe(true)
    expect(check(staged, { check: 'fileCommitted', path: 'a.txt' })).toBe(false)
    expect(check(world, { check: 'fileCommitted', path: 'b.txt' })).toBe(true)
    expect(check(world, { check: 'fileCommitted', path: 'b.txt', onBranch: 'main' })).toBe(false)
  })

  it('workingTreeClean', () => {
    expect(check(world, { check: 'workingTreeClean' })).toBe(true)
    expect(check(write(world, { 'new.txt': 'n' }), { check: 'workingTreeClean' })).toBe(false)
    expect(check(empty, { check: 'workingTreeClean' })).toBe(false)
  })

  it('branchContains, refsEqual and isMergeCommit', () => {
    expect(check(world, { check: 'branchContains', branch: 'feature', ref: 'main' })).toBe(true)
    expect(check(world, { check: 'branchContains', branch: 'main', ref: 'feature' })).toBe(false)
    const merged = state(['git switch main', 'git merge --no-ff feature'], world)
    expect(check(merged, { check: 'isMergeCommit', ref: 'main' })).toBe(true)
    expect(check(world, { check: 'isMergeCommit', ref: 'feature' })).toBe(false)
    const ff = state(['git switch main', 'git merge feature'], world)
    expect(check(ff, { check: 'refsEqual', ref: 'main', other: 'feature' })).toBe(true)
  })

  it('configEquals by scope', () => {
    const configured = state(['git config user.name "Repo Name"'], world)
    expect(check(configured, { check: 'configEquals', key: 'user.name', value: 'Repo Name' })).toBe(
      true,
    )
    expect(
      check(configured, {
        check: 'configEquals',
        key: 'user.name',
        scope: 'global',
        value: 'Test Player',
      }),
    ).toBe(true)
    expect(check(world, { check: 'configEquals', key: 'user.name', scope: 'local' })).toBe(false)
  })

  it('remote checks: remoteExists, remoteBranchMatches, upstreamIs', () => {
    const clonedWorld = state([`git clone ${URL}`], worldWithServer())
    expect(check(clonedWorld, { check: 'remoteExists', name: 'origin', url: URL })).toBe(true)
    expect(
      check(clonedWorld, {
        check: 'upstreamIs',
        branch: 'main',
        remote: 'origin',
        remoteBranch: 'main',
      }),
    ).toBe(true)
    expect(
      check(clonedWorld, { check: 'remoteBranchMatches', remote: 'origin', branch: 'main' }),
    ).toBe(true)
    const ahead = state(['git commit --allow-empty -m "local"'], clonedWorld)
    expect(check(ahead, { check: 'remoteBranchMatches', remote: 'origin', branch: 'main' })).toBe(
      false,
    )
    expect(
      check(state(['git push'], ahead), {
        check: 'remoteBranchMatches',
        remote: 'origin',
        branch: 'main',
      }),
    ).toBe(true)
  })

  it('lastCommitMessage', () => {
    expect(check(world, { check: 'lastCommitMessage', equals: 'Add b' })).toBe(true)
    expect(check(world, { check: 'lastCommitMessage', onBranch: 'main', contains: 'Fir' })).toBe(
      true,
    )
    expect(check(empty, { check: 'lastCommitMessage', contains: 'x' })).toBe(false)
  })

  it('combines checks with all, any and not', () => {
    const objective: Predicate = {
      all: [
        { check: 'branchExists', name: 'feature' },
        { check: 'commitCount', onBranch: 'main', min: 1 },
        { check: 'headPointsTo', ref: 'feature' },
      ],
    }
    expect(check(world, objective)).toBe(true)
    expect(check(state(['git switch main'], world), objective)).toBe(false)
    expect(check(world, { any: [{ check: 'headDetached' }, { check: 'isInitialized' }] })).toBe(
      true,
    )
    expect(check(world, { not: { check: 'headDetached' } })).toBe(true)
  })

  it('fails loudly on an unknown check (a content bug)', () => {
    expect(() => check(world, { check: 'nonsense' } as unknown as Predicate)).toThrow(
      /Unknown predicate check/,
    )
  })
})
