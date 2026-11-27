import { describe, expect, it } from 'vitest'
import { addCommand } from '../../src/engine/commands/add'
import { removeWorkingFile } from '../../src/engine/files'
import { fail, initialized, run, withCommit, write } from './helpers'

// Step 4: `git add`.
describe('git add', () => {
  it('stages an untracked file', () => {
    const world = write(initialized(), { 'a.txt': 'hello\n' })
    const { world: after, output } = run(world, addCommand, 'a.txt')
    expect(output).toBe('')
    expect(after.repo.stagingArea.get('a.txt')).toBe('hello\n')
  })

  it('stages the new content of a modified tracked file', () => {
    const world = write(withCommit({ 'a.txt': 'v1\n' }), { 'a.txt': 'v2\n' })
    expect(world.repo.stagingArea.get('a.txt')).toBe('v1\n')
    const after = run(world, addCommand, 'a.txt').world
    expect(after.repo.stagingArea.get('a.txt')).toBe('v2\n')
  })

  it('stages a deletion when a tracked file was removed', () => {
    const world = removeWorkingFile(withCommit({ 'a.txt': 'v1\n', 'b.txt': 'b\n' }), 'a.txt')
    const after = run(world, addCommand, 'a.txt').world
    expect(after.repo.stagingArea.has('a.txt')).toBe(false)
    expect(after.repo.stagingArea.get('b.txt')).toBe('b\n')
  })

  it('stages everything with "." and with -A, and whole directories by name', () => {
    const world = write(initialized(), { 'a.txt': 'a', 'src/x.ts': 'x', 'src/y.ts': 'y' })
    expect([...run(world, addCommand, '.').world.repo.stagingArea.keys()].sort()).toEqual([
      'a.txt',
      'src/x.ts',
      'src/y.ts',
    ])
    expect(run(world, addCommand, '-A').world.repo.stagingArea.size).toBe(3)
    expect([...run(world, addCommand, 'src').world.repo.stagingArea.keys()].sort()).toEqual([
      'src/x.ts',
      'src/y.ts',
    ])
  })

  it('supports simple wildcards', () => {
    const world = write(initialized(), { 'a.md': 'a', 'b.md': 'b', 'c.txt': 'c' })
    expect([...run(world, addCommand, '*.md').world.repo.stagingArea.keys()].sort()).toEqual([
      'a.md',
      'b.md',
    ])
  })

  it('errors on a file that does not exist', () => {
    const error = fail(initialized(), addCommand, 'missing.txt')
    expect(error.message).toBe("fatal: pathspec 'missing.txt' did not match any files")
    expect(error.explanation).not.toBe('')
  })

  it('errors when given nothing to add', () => {
    expect(fail(initialized(), addCommand).message).toMatch(/^Nothing specified, nothing added\./)
  })
})
