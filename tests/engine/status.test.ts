import { describe, expect, it } from 'vitest'
import { addCommand } from '../../src/engine/commands/add'
import { statusCommand } from '../../src/engine/commands/status'
import { removeWorkingFile } from '../../src/engine/files'
import { computeStatus } from '../../src/engine/status'
import { initialized, run, withCommit, write } from './helpers'

// Step 6: `git status`.
describe('computeStatus', () => {
  it('reports staged, unstaged and untracked files separately', () => {
    let world = withCommit({ 'tracked.txt': 'v1\n', 'gone.txt': 'g\n', 'both.txt': 'b1\n' })
    world = write(world, { 'tracked.txt': 'v2\n', 'new.txt': 'n\n', 'both.txt': 'b2\n' })
    world = removeWorkingFile(world, 'gone.txt')
    world = run(world, addCommand, 'both.txt').world
    world = write(world, { 'both.txt': 'b3\n', 'staged-new.txt': 's\n' })
    world = run(world, addCommand, 'staged-new.txt').world

    expect(computeStatus(world.repo)).toEqual({
      staged: [
        { path: 'both.txt', kind: 'modified' },
        { path: 'staged-new.txt', kind: 'added' },
      ],
      unstaged: [
        { path: 'both.txt', kind: 'modified' },
        { path: 'gone.txt', kind: 'deleted' },
        { path: 'tracked.txt', kind: 'modified' },
      ],
      untracked: ['new.txt'],
    })
  })

  it('is empty right after a commit', () => {
    expect(computeStatus(withCommit().repo)).toEqual({ staged: [], unstaged: [], untracked: [] })
  })
})

describe('git status', () => {
  it('describes a brand-new repository', () => {
    expect(run(initialized(), statusCommand).output).toBe(
      'On branch main\n\nNo commits yet\n\nnothing to commit (create/copy files and use "git add" to track)',
    )
  })

  it('shows staged files before the first commit', () => {
    const world = run(write(initialized(), { 'a.txt': 'a' }), addCommand, 'a.txt').world
    expect(run(world, statusCommand).output).toBe(
      [
        'On branch main',
        '',
        'No commits yet',
        '',
        'Changes to be committed:',
        '  (use "git rm --cached <file>..." to unstage)',
        '\tnew file:   a.txt',
      ].join('\n'),
    )
  })

  it('lists unstaged and untracked files with the right closing line', () => {
    const world = write(withCommit({ 'a.txt': 'v1\n' }), { 'a.txt': 'v2\n', 'b.txt': 'b' })
    const output = run(world, statusCommand).output
    expect(output).toContain('Changes not staged for commit:')
    expect(output).toContain('\tmodified:   a.txt')
    expect(output).toContain('Untracked files:')
    expect(output).toContain('\tb.txt')
    expect(
      output.endsWith('no changes added to commit (use "git add" and/or "git commit -a")'),
    ).toBe(true)
  })

  it('reports a clean tree', () => {
    expect(run(withCommit(), statusCommand).output).toBe(
      'On branch main\nnothing to commit, working tree clean',
    )
  })

  it('has a short format', () => {
    let world = write(withCommit({ 'a.txt': 'v1\n' }), {
      'a.txt': 'v2\n',
      'b.txt': 'b',
      'c.txt': 'c',
    })
    world = run(world, addCommand, 'c.txt').world
    expect(run(world, statusCommand, '-s').output).toBe(' M a.txt\nA  c.txt\n?? b.txt')
  })
})
