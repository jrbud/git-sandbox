import { describe, expect, it } from 'vitest'
import { runCommand, runCommands } from '../../src/engine/dispatcher'
import { COMMANDS, commandRegistry } from '../../src/engine/registry'
import { headCommitId } from '../../src/engine/repo'
import { freshWorld, write } from './helpers'
import { URL, worldWithServer } from './remoteHelpers'

function ok(result: ReturnType<typeof runCommand>) {
  if (!result.ok) throw new Error(`Expected success, got: ${result.error.message}`)
  return result
}

// Step 18: the command registry and dispatcher.
describe('command registry', () => {
  it('registers every command from steps 2-16 exactly once', () => {
    const names = COMMANDS.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
    expect([...commandRegistry.keys()].sort()).toEqual([
      'add',
      'branch',
      'checkout',
      'clone',
      'commit',
      'config',
      'diff',
      'fetch',
      'init',
      'log',
      'merge',
      'pull',
      'push',
      'remote',
      'status',
      'switch',
    ])
  })
})

describe('runCommand', () => {
  it('routes each command string to the right handler', () => {
    let world = write(freshWorld(), { 'a.txt': 'a\n' })
    const outputs: Record<string, string> = {}
    for (const line of [
      'git init',
      'git config user.name "Sam Lee"',
      'git status',
      'git add a.txt',
      'git diff --staged',
      'git commit -m "First"',
      'git log --oneline',
      'git branch feature',
      'git checkout feature',
      'git switch main',
      'git merge feature',
      'git remote add origin https://example.com/x.git',
    ]) {
      const result = ok(runCommand(world, line))
      outputs[line] = result.output
      world = result.world
    }
    expect(outputs['git init']).toMatch(/^Initialized empty Git repository/)
    expect(outputs['git status']).toContain('Untracked files:')
    expect(outputs['git diff --staged']).toContain('+++ b/a.txt')
    expect(outputs['git commit -m "First"']).toMatch(/^\[main \(root-commit\) [0-9a-f]{7}\] First/)
    expect(outputs['git log --oneline']).toMatch(/\(HEAD -> main\) First$/)
    expect(outputs['git checkout feature']).toBe("Switched to branch 'feature'")
    expect(outputs['git switch main']).toBe("Switched to branch 'main'")
    expect(outputs['git merge feature']).toBe('Already up to date.')
    expect(world.repo.config.get('user.name')).toBe('Sam Lee')
    expect(world.repo.remotes.has('origin')).toBe(true)
  })

  it('routes clone, fetch, pull and push', () => {
    const result = ok(
      runCommands(worldWithServer(), [`git clone ${URL}`, 'git fetch', 'git pull', 'git push']),
    )
    expect(result.output).toBe('Everything up-to-date')
    expect(headCommitId(result.world.repo)).toBe(
      result.world.servers.get(URL)!.branches.get('main'),
    )
  })

  it('returns "not a git command" for an unregistered command, with a suggestion for typos', () => {
    const typo = runCommand(freshWorld(), 'git comit -m "x"')
    expect(typo.ok).toBe(false)
    if (!typo.ok) {
      expect(typo.error.kind).toBe('unknown-command')
      expect(typo.error.message).toBe(
        "git: 'comit' is not a git command. See 'git --help'.\n\nThe most similar command is\n\tcommit",
      )
    }
    const nonsense = runCommand(freshWorld(), 'git frobnicate')
    if (!nonsense.ok)
      expect(nonsense.error.message).toBe(
        "git: 'frobnicate' is not a git command. See 'git --help'.",
      )
  })

  it('returns failures without changing the world, and never throws for player mistakes', () => {
    const world = freshWorld()
    const result = runCommand(world, 'git status')
    expect(result.ok).toBe(false)
    expect(result.world).toBe(world)
    if (!result.ok) {
      expect(result.error.kind).toBe('fatal')
      expect(result.error.message).toMatch(/not a git repository/)
      expect(result.error.explanation).not.toBe('')
    }
    expect(runCommand(world, 'git commit -m "unterminated').ok).toBe(false)
    expect(runCommand(world, 'git commit --bogus').ok).toBe(false)
  })

  it('treats a blank line as a no-op', () => {
    const world = freshWorld()
    expect(runCommand(world, '   ')).toEqual({ ok: true, world, output: '' })
  })
})
