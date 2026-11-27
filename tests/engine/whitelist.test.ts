import { describe, expect, it } from 'vitest'
import { runCommand, runCommands } from '../../src/engine/dispatcher'
import { freshWorld, write } from './helpers'

const level = { allowedCommands: ['git init', 'git add', 'git commit -m', 'git status'] }

function error(input: string, options = level, world = freshWorld()) {
  const result = runCommand(world, input, options)
  if (result.ok) throw new Error(`Expected "${input}" to be rejected`)
  return result.error
}

// Step 19: per-level allowedCommands enforcement.
describe('allowedCommands whitelist', () => {
  it('lets whitelisted commands through', () => {
    const result = runCommands(
      write(freshWorld(), { 'a.txt': 'a' }),
      ['git init', 'git add .', 'git commit -m "x"'],
      level,
    )
    expect(result.ok).toBe(true)
  })

  it('rejects a real, supported command the level does not allow, with an explanation', () => {
    const e = error('git branch feature')
    expect(e.kind).toBe('not-allowed')
    expect(e.message).toBe("fatal: 'git branch' is not available in this level")
    expect(e.explanation).toMatch(/real git command/)
    expect(e.explanation).toContain('git init, git add, git commit -m, git status')
  })

  it('rejects flags that are not listed when the entry names specific flags', () => {
    const e = error('git commit -am "x"')
    expect(e.kind).toBe('not-allowed')
    expect(e.message).toBe("fatal: option '-a' is not available in this level")
    // Aliases of an allowed flag are fine.
    const world = runCommands(
      write(freshWorld(), { 'a.txt': 'a' }),
      ['git init', 'git add a.txt'],
      level,
    ).world
    expect(runCommand(world, 'git commit --message "x"', level).ok).toBe(true)
  })

  it('limits subcommands when the entry names one', () => {
    const options = { allowedCommands: ['git init', 'git remote add', 'git remote -v'] }
    const world = runCommand(freshWorld(), 'git init', options).world
    expect(runCommand(world, 'git remote add origin https://example.com/x.git', options).ok).toBe(
      true,
    )
    expect(runCommand(world, 'git remote -v', options).ok).toBe(true)
    expect(error('git remote remove origin', options, world).message).toBe(
      "fatal: 'git remote remove' is not available in this level",
    )
  })

  it('rejects an unsupported command differently from a non-whitelisted one', () => {
    const unsupported = error('git rebase main')
    expect(unsupported.kind).toBe('unsupported-command')
    expect(unsupported.message).toBe("git: 'rebase' is not supported in Git Quest yet")
    const unknown = error('git fly')
    expect(unknown.kind).toBe('unknown-command')
    expect(error('git branch').kind).toBe('not-allowed')
  })

  it('allows everything when no whitelist is given (Free Play)', () => {
    const world = runCommands(write(freshWorld(), { 'a.txt': 'a' }), [
      'git init',
      'git add .',
      'git commit -m x',
    ]).world
    expect(runCommand(world, 'git branch feature').ok).toBe(true)
  })
})
