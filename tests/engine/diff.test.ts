import { describe, expect, it } from 'vitest'
import { addCommand } from '../../src/engine/commands/add'
import { diffCommand } from '../../src/engine/commands/diff'
import { diffLines, formatDiffstat, merge3, diffTrees } from '../../src/engine/diff'
import { removeWorkingFile } from '../../src/engine/files'
import { blobId } from '../../src/engine/hash'
import { run, withCommit, write } from './helpers'

const id = (content: string) => blobId(content).slice(0, 7)

// Step 8: `git diff` (working directory vs. staging area, and --staged vs. the last commit).
describe('git diff', () => {
  it('shows a modified file as a unified diff against the staging area', () => {
    const world = write(withCommit({ 'a.txt': 'one\ntwo\nthree\n' }), {
      'a.txt': 'one\nTWO\nthree\n',
    })
    expect(run(world, diffCommand).output).toBe(
      [
        'diff --git a/a.txt b/a.txt',
        `index ${id('one\ntwo\nthree\n')}..${id('one\nTWO\nthree\n')} 100644`,
        '--- a/a.txt',
        '+++ b/a.txt',
        '@@ -1,3 +1,3 @@',
        ' one',
        '-two',
        '+TWO',
        ' three',
      ].join('\n'),
    )
  })

  it('shows a deleted file, and ignores untracked files', () => {
    let world = removeWorkingFile(withCommit({ 'a.txt': 'x\n' }), 'a.txt')
    world = write(world, { 'untracked.txt': 'u\n' })
    expect(run(world, diffCommand).output).toBe(
      [
        'diff --git a/a.txt b/a.txt',
        'deleted file mode 100644',
        `index ${id('x\n')}..0000000`,
        '--- a/a.txt',
        '+++ /dev/null',
        '@@ -1 +0,0 @@',
        '-x',
      ].join('\n'),
    )
  })

  it('is empty once the change is staged, and --staged shows it instead', () => {
    let world = write(withCommit({ 'a.txt': 'v1\n' }), { 'a.txt': 'v2\n', 'b.txt': 'new\n' })
    world = run(world, addCommand, '.').world
    expect(run(world, diffCommand).output).toBe('')
    expect(run(world, diffCommand, '--staged').output).toBe(
      [
        'diff --git a/a.txt b/a.txt',
        `index ${id('v1\n')}..${id('v2\n')} 100644`,
        '--- a/a.txt',
        '+++ b/a.txt',
        '@@ -1 +1 @@',
        '-v1',
        '+v2',
        'diff --git a/b.txt b/b.txt',
        'new file mode 100644',
        `index 0000000..${id('new\n')}`,
        '--- /dev/null',
        '+++ b/b.txt',
        '@@ -0,0 +1 @@',
        '+new',
      ].join('\n'),
    )
    expect(run(world, diffCommand, '--cached', 'b.txt').output).toContain('b/b.txt')
    expect(run(world, diffCommand, '--cached', 'b.txt').output).not.toContain('a/a.txt')
  })

  it('splits distant changes into separate hunks', () => {
    const before = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n') + '\n'
    const after = before.replace('line 2\n', 'line two\n').replace('line 19\n', 'line nineteen\n')
    const world = write(withCommit({ 'a.txt': before }), { 'a.txt': after })
    const hunks = run(world, diffCommand)
      .output.split('\n')
      .filter((l) => l.startsWith('@@'))
    expect(hunks).toEqual(['@@ -1,5 +1,5 @@', '@@ -16,5 +16,5 @@'])
  })
})

describe('diff helpers', () => {
  it('diffLines finds a minimal edit script', () => {
    expect(diffLines(['a', 'b', 'c'], ['a', 'c', 'd'])).toEqual([
      { type: 'equal', line: 'a' },
      { type: 'delete', line: 'b' },
      { type: 'equal', line: 'c' },
      { type: 'insert', line: 'd' },
    ])
  })

  it('formats a diffstat', () => {
    const changes = diffTrees(
      new Map([['a.txt', '1\n2\n']]),
      new Map([
        ['a.txt', '1\n3\n'],
        ['b.txt', 'x\n'],
      ]),
    )
    expect(formatDiffstat(changes)).toBe(
      ' a.txt | 2 +-\n b.txt | 1 +\n 2 files changed, 2 insertions(+), 1 deletion(-)',
    )
  })

  it('merge3 combines changes to different lines and rejects overlapping ones', () => {
    const base = 'a\nb\nc\nd\ne\n'
    expect(merge3(base, 'A\nb\nc\nd\ne\n', 'a\nb\nc\nd\nE\n')).toEqual({
      ok: true,
      content: 'A\nb\nc\nd\nE\n',
    })
    expect(merge3(base, 'a\nX\nc\nd\ne\n', 'a\nY\nc\nd\ne\n')).toEqual({ ok: false })
    expect(merge3(base, base + 'f\n', base)).toEqual({ ok: true, content: base + 'f\n' })
  })
})
