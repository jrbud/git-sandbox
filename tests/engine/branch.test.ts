import { describe, expect, it } from 'vitest'
import { branchCommand } from '../../src/engine/commands/branch'
import { checkoutCommand } from '../../src/engine/commands/checkout'
import { headCommitId } from '../../src/engine/repo'
import { commitFiles, fail, initialized, run, withCommit } from './helpers'

// Step 9: `git branch` (create, list, delete).
describe('git branch', () => {
  it("creates a branch pointing at HEAD's commit without switching to it", () => {
    const world = withCommit()
    const { world: after, output } = run(world, branchCommand, 'feature')
    expect(output).toBe('')
    expect(after.repo.branches.get('feature')).toBe(headCommitId(world.repo))
    expect(after.repo.HEAD).toEqual({ type: 'branch', ref: 'main' })
  })

  it('creates a branch at a given start point', () => {
    const first = withCommit({ 'a.txt': '1' })
    const firstId = headCommitId(first.repo)!
    const world = commitFiles(first, { 'a.txt': '2' }, 'Second')
    expect(run(world, branchCommand, 'old', 'HEAD~1').world.repo.branches.get('old')).toBe(firstId)
  })

  it('lists all branches and marks the current one', () => {
    let world = run(withCommit(), branchCommand, 'feature').world
    world = run(world, branchCommand, 'bugfix').world
    expect(run(world, branchCommand).output).toBe('  bugfix\n  feature\n* main')
  })

  it('deletes a merged branch', () => {
    const world = run(withCommit(), branchCommand, 'feature').world
    const { world: after, output } = run(world, branchCommand, '-d', 'feature')
    expect(after.repo.branches.has('feature')).toBe(false)
    expect(output).toBe(`Deleted branch feature (was ${headCommitId(world.repo)!.slice(0, 7)}).`)
  })

  it('refuses to delete the current branch', () => {
    expect(fail(withCommit(), branchCommand, '-d', 'main').message).toMatch(
      /^error: cannot delete branch 'main'/,
    )
  })

  it('refuses -d on an unmerged branch but allows -D', () => {
    let world = run(withCommit(), checkoutCommand, '-b', 'feature').world
    world = commitFiles(world, { 'f.txt': 'f' }, 'Feature work')
    world = run(world, checkoutCommand, 'main').world
    expect(fail(world, branchCommand, '-d', 'feature').message).toMatch(/is not fully merged/)
    expect(run(world, branchCommand, '-D', 'feature').world.repo.branches.has('feature')).toBe(
      false,
    )
  })

  it('rejects duplicate and invalid names, and branching before the first commit', () => {
    expect(fail(withCommit(), branchCommand, 'main').message).toBe(
      "fatal: a branch named 'main' already exists",
    )
    expect(fail(withCommit(), branchCommand, 'my branch').message).toBe(
      "fatal: 'my branch' is not a valid branch name",
    )
    expect(fail(initialized(), branchCommand, 'feature').message).toBe(
      "fatal: not a valid object name: 'main'",
    )
  })

  it('errors when deleting a branch that does not exist', () => {
    expect(fail(withCommit(), branchCommand, '-d', 'ghost').message).toBe(
      "error: branch 'ghost' not found",
    )
  })
})
