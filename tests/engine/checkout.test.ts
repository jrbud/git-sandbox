import { describe, expect, it } from 'vitest'
import { addCommand } from '../../src/engine/commands/add'
import { branchCommand } from '../../src/engine/commands/branch'
import { checkoutCommand } from '../../src/engine/commands/checkout'
import { switchCommand } from '../../src/engine/commands/switch'
import { headCommitId } from '../../src/engine/repo'
import type { World } from '../../src/engine/types'
import { commitFiles, fail, initialized, run, withCommit, write } from './helpers'

/** main has a.txt=main; feature adds f.txt and changes a.txt. */
function twoBranches(): World {
  let world = withCommit({ 'a.txt': 'main\n' })
  world = run(world, checkoutCommand, '-b', 'feature').world
  world = commitFiles(world, { 'a.txt': 'feature\n', 'f.txt': 'f\n' }, 'Feature work')
  return run(world, checkoutCommand, 'main').world
}

// Step 10: `git checkout` / `git switch`.
describe('git checkout / git switch', () => {
  it("moves HEAD and makes the working directory match the branch's tree", () => {
    const world = twoBranches()
    expect(world.repo.workingDirectory.get('a.txt')).toBe('main\n')
    expect(world.repo.workingDirectory.has('f.txt')).toBe(false)

    for (const command of [checkoutCommand, switchCommand]) {
      const { world: after, output } = run(world, command, 'feature')
      expect(output).toBe("Switched to branch 'feature'")
      expect(after.repo.HEAD).toEqual({ type: 'branch', ref: 'feature' })
      expect(after.repo.workingDirectory.get('a.txt')).toBe('feature\n')
      expect(after.repo.workingDirectory.get('f.txt')).toBe('f\n')
      expect(after.repo.stagingArea).toEqual(after.repo.workingDirectory)
    }
  })

  it('creates and switches with checkout -b and switch -c', () => {
    const world = withCommit()
    for (const [command, flag] of [
      [checkoutCommand, '-b'],
      [switchCommand, '-c'],
    ] as const) {
      const { world: after, output } = run(world, command, flag, 'topic')
      expect(output).toBe("Switched to a new branch 'topic'")
      expect(after.repo.HEAD).toEqual({ type: 'branch', ref: 'topic' })
      expect(after.repo.branches.get('topic')).toBe(headCommitId(world.repo))
    }
  })

  it('says when you are already on the branch', () => {
    expect(run(withCommit(), switchCommand, 'main').output).toBe("Already on 'main'")
  })

  it('errors on a branch that does not exist', () => {
    expect(fail(withCommit(), checkoutCommand, 'nope').message).toBe(
      "error: pathspec 'nope' did not match any file(s) known to git",
    )
    expect(fail(withCommit(), switchCommand, 'nope').message).toBe('fatal: invalid reference: nope')
  })

  it('carries uncommitted changes to files that are the same on both branches', () => {
    let world = twoBranches()
    world = write(world, { 'notes.txt': 'scratch\n' })
    world = run(world, switchCommand, 'feature').world
    expect(world.repo.workingDirectory.get('notes.txt')).toBe('scratch\n')
  })

  it('refuses to overwrite uncommitted changes to a file that differs between branches', () => {
    const world = write(twoBranches(), { 'a.txt': 'local edit\n' })
    const error = fail(world, switchCommand, 'feature')
    expect(error.message).toBe(
      [
        'error: Your local changes to the following files would be overwritten by checkout:',
        '\ta.txt',
        'Please commit your changes or stash them before you switch branches.',
        'Aborting',
      ].join('\n'),
    )
  })

  it('refuses to overwrite an untracked file in the way', () => {
    const world = write(twoBranches(), { 'f.txt': 'mine\n' })
    expect(fail(world, checkoutCommand, 'feature').message).toMatch(
      /^error: The following untracked working tree files would be overwritten by checkout:\n\tf\.txt/,
    )
  })

  it('checks out a commit as a detached HEAD; switch needs --detach for that', () => {
    let world = withCommit({ 'a.txt': '1\n' })
    const first = headCommitId(world.repo)!
    world = commitFiles(world, { 'a.txt': '2\n' }, 'Second')

    const { world: detached, output } = run(world, checkoutCommand, first.slice(0, 7))
    expect(detached.repo.HEAD).toEqual({ type: 'detached', ref: first })
    expect(detached.repo.workingDirectory.get('a.txt')).toBe('1\n')
    expect(output).toContain("You are in 'detached HEAD' state.")
    expect(fail(world, switchCommand, first).message).toMatch(
      /^fatal: a branch is expected, got commit/,
    )
    expect(run(world, switchCommand, '--detach', 'HEAD~1').world.repo.HEAD.type).toBe('detached')

    const back = run(detached, switchCommand, 'main')
    expect(back.output).toBe(
      `Previous HEAD position was ${first.slice(0, 7)} Initial commit\nSwitched to branch 'main'`,
    )
  })

  it('lets you pick the branch name before the first commit', () => {
    const { world } = run(initialized(), switchCommand, '-c', 'trunk')
    expect(world.repo.HEAD).toEqual({ type: 'branch', ref: 'trunk' })
    const committed = commitFiles(world, { 'a.txt': 'a' }, 'First')
    expect(committed.repo.branches.has('trunk')).toBe(true)
  })

  it('keeps staged new files when switching', () => {
    let world = run(twoBranches(), branchCommand, 'other').world
    world = run(write(world, { 'new.txt': 'n\n' }), addCommand, 'new.txt').world
    world = run(world, switchCommand, 'other').world
    expect(world.repo.stagingArea.get('new.txt')).toBe('n\n')
  })
})
