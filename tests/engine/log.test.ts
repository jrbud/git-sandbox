import { describe, expect, it } from 'vitest'
import { createCommit, headCommitId, moveHead } from '../../src/engine/repo'
import { logCommand } from '../../src/engine/commands/log'
import type { World } from '../../src/engine/types'
import { commitFiles, fail, initialized, run, withCommit } from './helpers'

function threeCommits(): World {
  let world = withCommit({ 'a.txt': '1\n' })
  world = commitFiles(world, { 'a.txt': '2\n' }, 'Second')
  return commitFiles(world, { 'a.txt': '3\n' }, 'Third')
}

// Step 7: `git log`.
describe('git log', () => {
  it('walks parents from HEAD, newest first, for a linear history', () => {
    const output = run(threeCommits(), logCommand, '--oneline').output
    const lines = output.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatch(/^[0-9a-f]{7} \(HEAD -> main\) Third$/)
    expect(lines[1]).toMatch(/^[0-9a-f]{7} Second$/)
    expect(lines[2]).toMatch(/^[0-9a-f]{7} Initial commit$/)
  })

  it('prints the full format with author, date and indented message', () => {
    const world = withCommit()
    const id = headCommitId(world.repo)!
    expect(run(world, logCommand).output).toBe(
      [
        `commit ${id} (HEAD -> main)`,
        'Author: Test Player <player@example.com>',
        'Date:   Thu Jan 1 00:00:00 2026 +0000',
        '',
        '    Initial commit',
      ].join('\n'),
    )
  })

  it('includes both sides of a merge, and marks the merge commit', () => {
    // Build a diamond by hand: base -> (left, right) -> merge.
    const world = withCommit({ 'a.txt': 'base\n' })
    const author = { name: 'Test Player', email: 'player@example.com' }
    const base = headCommitId(world.repo)!
    const left = createCommit(world, {
      parents: [base],
      message: 'Left',
      tree: new Map([['a.txt', 'l\n']]),
      author,
    })
    const right = createCommit(world, {
      parents: [base],
      message: 'Right',
      tree: new Map([['a.txt', 'r\n']]),
      author,
    })
    const merge = createCommit(world, {
      parents: [left.id, right.id],
      message: 'Merge',
      tree: new Map([['a.txt', 'lr\n']]),
      author,
    })
    moveHead(world.repo, merge.id)

    const messages = run(world, logCommand, '--oneline')
      .output.split('\n')
      .map((line) => line.replace(/^[0-9a-f]{7} (\([^)]*\) )?/, ''))
    expect(messages).toEqual(['Merge', 'Right', 'Left', 'Initial commit'])
    expect(run(world, logCommand, '-n', '1').output).toContain(
      `Merge: ${left.id.slice(0, 7)} ${right.id.slice(0, 7)}`,
    )
  })

  it('limits output with -n and -<number>', () => {
    expect(run(threeCommits(), logCommand, '--oneline', '-n', '2').output.split('\n')).toHaveLength(
      2,
    )
    expect(run(threeCommits(), logCommand, '--oneline', '-1').output.split('\n')).toHaveLength(1)
  })

  it('errors when there are no commits yet', () => {
    expect(fail(initialized(), logCommand).message).toBe(
      "fatal: your current branch 'main' does not have any commits yet",
    )
  })

  it('errors on an unknown revision', () => {
    expect(fail(withCommit(), logCommand, 'nope').message).toMatch(/ambiguous argument 'nope'/)
  })
})
