import { describe, expect, it } from 'vitest'
import { addCommand } from '../../src/engine/commands/add'
import { commitCommand } from '../../src/engine/commands/commit'
import { removeWorkingFile } from '../../src/engine/files'
import { createWorld, headCommitId, headTree } from '../../src/engine/repo'
import { computeStatus } from '../../src/engine/status'
import { initCommand } from '../../src/engine/commands/init'
import { commitFiles, fail, initialized, run, withCommit, write } from './helpers'

// Step 5: `git commit`.
describe('git commit', () => {
  it('creates a root commit, points main at it and prints a git-style summary', () => {
    const staged = run(write(initialized(), { 'a.txt': 'one\ntwo\n' }), addCommand, 'a.txt').world
    const { world, output } = run(staged, commitCommand, '-m', 'First commit')

    const id = world.repo.branches.get('main')!
    const commit = world.repo.commits.get(id)!
    expect(commit.parents).toEqual([])
    expect(commit.message).toBe('First commit')
    expect(commit.treeSnapshot.get('a.txt')).toBe('one\ntwo\n')
    expect(output).toBe(
      `[main (root-commit) ${id.slice(0, 7)}] First commit\n 1 file changed, 2 insertions(+)\n create mode 100644 a.txt`,
    )
  })

  it('uses the previous commit as the parent and advances the branch', () => {
    const first = withCommit({ 'a.txt': 'v1\n' })
    const parent = headCommitId(first.repo)!
    const second = commitFiles(first, { 'a.txt': 'v2\n' }, 'Second')
    const id = headCommitId(second.repo)!
    expect(id).not.toBe(parent)
    expect(second.repo.commits.get(id)!.parents).toEqual([parent])
    expect(second.repo.branches.get('main')).toBe(id)
  })

  it('leaves no staged changes: the staging area now matches the new commit', () => {
    const world = withCommit({ 'a.txt': 'v1\n' })
    expect(computeStatus(world.repo).staged).toEqual([])
    expect(world.repo.stagingArea).toEqual(headTree(world.repo))
  })

  it('only records staged content, not unstaged edits', () => {
    let world = run(write(initialized(), { 'a.txt': 'staged\n' }), addCommand, 'a.txt').world
    world = write(world, { 'a.txt': 'edited later\n' })
    world = run(world, commitCommand, '-m', 'Commit').world
    expect(headTree(world.repo).get('a.txt')).toBe('staged\n')
  })

  it('records deletions', () => {
    let world = removeWorkingFile(withCommit({ 'a.txt': 'a', 'b.txt': 'b' }), 'a.txt')
    world = run(world, addCommand, 'a.txt').world
    const { world: after, output } = run(world, commitCommand, '-m', 'Remove a')
    expect(headTree(after.repo).has('a.txt')).toBe(false)
    expect(output).toContain('delete mode 100644 a.txt')
  })

  it('stages tracked changes first with -a (but not untracked files)', () => {
    let world = write(withCommit({ 'a.txt': 'v1\n' }), { 'a.txt': 'v2\n', 'new.txt': 'n' })
    world = run(world, commitCommand, '-am', 'Update a').world
    expect(headTree(world.repo).get('a.txt')).toBe('v2\n')
    expect(headTree(world.repo).has('new.txt')).toBe(false)
  })

  it('errors with nothing staged', () => {
    const error = fail(withCommit(), commitCommand, '-m', 'Nothing')
    expect(error.message).toBe('On branch main\nnothing to commit, working tree clean')
    const untracked = fail(write(withCommit(), { 'x.txt': 'x' }), commitCommand, '-m', 'Nothing')
    expect(untracked.message).toMatch(/nothing added to commit but untracked files present/)
  })

  it('errors without a message, because there is no editor', () => {
    const world = run(write(initialized(), { 'a.txt': 'a' }), addCommand, 'a.txt').world
    expect(fail(world, commitCommand).message).toBe('Aborting commit due to empty commit message.')
  })

  it('errors when no author identity is configured', () => {
    let world = run(createWorld(), initCommand).world
    world = run(write(world, { 'a.txt': 'a' }), addCommand, 'a.txt').world
    const error = fail(world, commitCommand, '-m', 'Hi')
    expect(error.message).toMatch(/^Author identity unknown/)
    expect(error.explanation).toMatch(/git config/)
  })

  it('is deterministic: the same steps give the same commit id', () => {
    const a = withCommit({ 'a.txt': 'same\n' })
    const b = withCommit({ 'a.txt': 'same\n' })
    expect(headCommitId(a.repo)).toBe(headCommitId(b.repo))
    expect(headCommitId(a.repo)).toMatch(/^[0-9a-f]{40}$/)
  })
})
