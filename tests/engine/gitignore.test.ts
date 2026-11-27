import { describe, expect, it } from 'vitest'
import { addCommand } from '../../src/engine/commands/add'
import { statusCommand } from '../../src/engine/commands/status'
import { isIgnored, parseIgnoreFile, loadIgnoreRules } from '../../src/engine/ignore'
import { fileMapFromObject } from '../../src/engine/files'
import { computeStatus } from '../../src/engine/status'
import { fail, initialized, run, withCommit, write } from './helpers'

function ignored(gitignore: string, path: string): boolean {
  return isIgnored(path, parseIgnoreFile(gitignore))
}

// Step 14: .gitignore pattern matching.
describe('.gitignore patterns', () => {
  it('matches file names anywhere, wildcards and extensions', () => {
    expect(ignored('secret.txt', 'secret.txt')).toBe(true)
    expect(ignored('secret.txt', 'config/secret.txt')).toBe(true)
    expect(ignored('*.log', 'logs/app.log')).toBe(true)
    expect(ignored('*.log', 'app.txt')).toBe(false)
    expect(ignored('file?.txt', 'file1.txt')).toBe(true)
    expect(ignored('[ab].txt', 'b.txt')).toBe(true)
  })

  it('ignores everything inside a matching directory', () => {
    expect(ignored('node_modules/', 'node_modules/react/index.js')).toBe(true)
    expect(ignored('build', 'build/out.js')).toBe(true)
    expect(ignored('build/', 'build')).toBe(false) // a file named "build" is not a directory
  })

  it('anchors patterns that contain a slash', () => {
    expect(ignored('/todo.txt', 'todo.txt')).toBe(true)
    expect(ignored('/todo.txt', 'docs/todo.txt')).toBe(false)
    expect(ignored('docs/*.md', 'docs/a.md')).toBe(true)
    expect(ignored('docs/*.md', 'docs/sub/a.md')).toBe(false)
    expect(ignored('docs/**/*.md', 'docs/sub/a.md')).toBe(true)
  })

  it('supports negation, comments and blank lines', () => {
    const rules = '# logs\n\n*.log\n!keep.log\n'
    expect(ignored(rules, 'debug.log')).toBe(true)
    expect(ignored(rules, 'keep.log')).toBe(false)
    // A file inside an ignored directory cannot be re-included.
    expect(ignored('logs/\n!logs/keep.log', 'logs/keep.log')).toBe(true)
  })

  it('reads nested .gitignore files relative to their folder', () => {
    const wd = fileMapFromObject({ '.gitignore': '*.tmp\n', 'web/.gitignore': 'dist/\n' })
    const rules = loadIgnoreRules(wd)
    expect(isIgnored('web/dist/app.js', rules)).toBe(true)
    expect(isIgnored('dist/app.js', rules)).toBe(false)
    expect(isIgnored('web/a.tmp', rules)).toBe(true)
  })
})

describe('.gitignore in commands', () => {
  it('hides ignored files from the untracked list in git status', () => {
    const world = write(initialized(), { '.gitignore': '*.log\n', 'app.log': 'x', 'app.js': 'y' })
    expect(computeStatus(world.repo).untracked).toEqual(['.gitignore', 'app.js'])
    expect(run(world, statusCommand).output).not.toContain('app.log')
  })

  it('refuses to git add an ignored file without -f', () => {
    const world = write(initialized(), { '.gitignore': 'secret.txt\n', 'secret.txt': 'shh' })
    const error = fail(world, addCommand, 'secret.txt')
    expect(error.message).toBe(
      'The following paths are ignored by one of your .gitignore files:\nsecret.txt\nhint: Use -f if you really want to add them.',
    )
    expect(
      run(world, addCommand, '-f', 'secret.txt').world.repo.stagingArea.get('secret.txt'),
    ).toBe('shh')
  })

  it('skips ignored files quietly when adding everything', () => {
    const world = write(initialized(), { '.gitignore': '*.log\n', 'app.log': 'x', 'app.js': 'y' })
    const staged = [...run(world, addCommand, '.').world.repo.stagingArea.keys()].sort()
    expect(staged).toEqual(['.gitignore', 'app.js'])
  })

  it('does not affect files that are already tracked', () => {
    let world = withCommit({ 'app.log': 'v1' })
    world = write(world, { '.gitignore': '*.log\n', 'app.log': 'v2' })
    expect(computeStatus(world.repo).unstaged).toEqual([{ path: 'app.log', kind: 'modified' }])
    expect(run(world, addCommand, 'app.log').world.repo.stagingArea.get('app.log')).toBe('v2')
  })
})
