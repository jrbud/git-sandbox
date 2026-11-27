import { describe, expect, it } from 'vitest'
import { runCommand, runCommands, type DispatchResult } from '../../src/engine/dispatcher'
import { tokenizeLine } from '../../src/engine/parser'
import type { World } from '../../src/engine/types'
import { freshWorld, initialized, write } from './helpers'

function ok(result: DispatchResult) {
  if (!result.ok) throw new Error(`Expected success, got: ${result.error.message}`)
  return result
}

function failure(world: World, input: string) {
  const result = runCommand(world, input)
  if (result.ok) throw new Error(`Expected "${input}" to fail`)
  return result.error
}

const files = (world: World) => Object.fromEntries(world.repo.workingDirectory)

// Phase 2 step 1: basic file commands in the terminal.
describe('file commands', () => {
  it('touch creates empty files and leaves existing ones alone', () => {
    const world = ok(
      runCommands(write(freshWorld(), { 'a.txt': 'keep\n' }), ['touch a.txt b.txt src/c.js']),
    ).world
    expect(files(world)).toEqual({ 'a.txt': 'keep\n', 'b.txt': '', 'src/c.js': '' })
  })

  it('echo prints text, overwrites with > and appends with >>', () => {
    expect(ok(runCommand(freshWorld(), 'echo hello   world')).output).toBe('hello world')
    const world = ok(
      runCommands(freshWorld(), [
        'echo "first line" > notes.txt',
        'echo second>>notes.txt',
        'echo "-n is text"  >> notes.txt',
      ]),
    ).world
    expect(files(world)).toEqual({ 'notes.txt': 'first line\nsecond\n-n is text\n' })
    expect(files(ok(runCommand(world, "echo 'replaced' > notes.txt")).world)).toEqual({
      'notes.txt': 'replaced\n',
    })
  })

  it('a quoted ">" is text, not a redirect', () => {
    expect(ok(runCommand(freshWorld(), 'echo "a > b"')).output).toBe('a > b')
    expect(tokenizeLine('echo a>b')).toEqual([
      { text: 'echo', operator: false },
      { text: 'a', operator: false },
      { text: '>', operator: true },
      { text: 'b', operator: false },
    ])
  })

  it('cat prints files, and errors on missing files and folders', () => {
    const world = write(freshWorld(), { 'a.txt': 'one\ntwo\n', 'src/x.js': 'x' })
    expect(ok(runCommand(world, 'cat a.txt')).output).toBe('one\ntwo')
    expect(failure(world, 'cat nope.txt').message).toBe('cat: nope.txt: No such file or directory')
    expect(failure(world, 'cat src').message).toBe('cat: src: Is a directory')
  })

  it('ls lists files and folders, hiding dotfiles unless -a', () => {
    const world = write(initialized(), {
      'b.txt': 'b',
      'a.txt': 'a',
      'src/x.js': 'x',
      '.gitignore': '*.log\n',
    })
    expect(ok(runCommand(world, 'ls')).output).toBe('a.txt  b.txt  src/')
    expect(ok(runCommand(world, 'ls -a')).output).toBe('.git/  .gitignore  a.txt  b.txt  src/')
    expect(ok(runCommand(world, 'ls src')).output).toBe('x.js')
    expect(failure(world, 'ls nope').message).toBe(
      "ls: cannot access 'nope': No such file or directory",
    )
    expect(ok(runCommand(freshWorld(), 'ls')).output).toBe('')
  })

  it('rm deletes files, and folders only with -r', () => {
    const world = write(freshWorld(), { 'a.txt': 'a', 'src/x.js': 'x', 'src/y.js': 'y' })
    expect(files(ok(runCommand(world, 'rm a.txt')).world)).toEqual({
      'src/x.js': 'x',
      'src/y.js': 'y',
    })
    expect(failure(world, 'rm src').message).toBe("rm: cannot remove 'src': Is a directory")
    expect(files(ok(runCommand(world, 'rm -r src')).world)).toEqual({ 'a.txt': 'a' })
    expect(failure(world, 'rm ghost.txt').message).toBe(
      "rm: cannot remove 'ghost.txt': No such file or directory",
    )
    expect(ok(runCommand(world, 'rm -f ghost.txt')).ok).toBe(true)
  })

  it('refuses paths outside the project folder', () => {
    expect(failure(freshWorld(), 'touch ../escape.txt').message).toBe(
      'touch: ../escape.txt: Permission denied',
    )
    expect(failure(freshWorld(), 'echo x > .git/config').kind).toBe('fatal')
  })

  it('changes are what git sees', () => {
    const result = ok(runCommands(initialized(), ['echo "hi" > hello.txt', 'git status --short']))
    expect(result.output).toBe('?? hello.txt')
  })

  it('works even when the level does not allow those programs as git commands', () => {
    const level = { allowedCommands: ['git status'] }
    expect(runCommand(freshWorld(), 'touch a.txt', level).ok).toBe(true)
  })

  it('still reports other programs as "command not found"', () => {
    const error = failure(freshWorld(), 'mkdir src')
    expect(error.kind).toBe('parse')
    expect(error.message).toBe('mkdir: command not found')
  })

  it('rejects redirects outside echo, and incomplete redirects', () => {
    expect(failure(freshWorld(), 'git log > out.txt').message).toMatch(/can't redirect git output/)
    expect(failure(freshWorld(), 'cat a.txt > b.txt').message).toMatch(
      /only supports > and >> with echo/,
    )
    expect(failure(freshWorld(), 'echo hi >').message).toBe(
      "bash: syntax error near unexpected token `newline'",
    )
  })

  it('needs file names', () => {
    expect(failure(freshWorld(), 'touch').message).toBe('touch: missing file operand')
  })
})
