import { blobId, shortId } from './hash'
import type { FileMap } from './types'

export type LineOp =
  | { type: 'equal'; line: string }
  | { type: 'delete'; line: string }
  | { type: 'insert'; line: string }

export type ChangeKind = 'added' | 'modified' | 'deleted'

export interface FileChange {
  path: string
  kind: ChangeKind
  oldContent?: string
  newContent?: string
}

export function splitLines(content: string): string[] {
  if (content === '') return []
  const lines = content.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

/** Pairs [i, j] where a[i] === b[j], forming a longest common subsequence. */
export function lcsMatches(a: string[], b: string[]): Array<[number, number]> {
  const n = a.length
  const m = b.length
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const matches: Array<[number, number]> = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      matches.push([i, j])
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i++
    } else {
      j++
    }
  }
  return matches
}

export function diffLines(a: string[], b: string[]): LineOp[] {
  const ops: LineOp[] = []
  let i = 0
  let j = 0
  for (const [mi, mj] of [...lcsMatches(a, b), [a.length, b.length] as [number, number]]) {
    while (i < mi) ops.push({ type: 'delete', line: a[i++] })
    while (j < mj) ops.push({ type: 'insert', line: b[j++] })
    if (mi < a.length) {
      ops.push({ type: 'equal', line: a[mi] })
      i++
      j++
    }
  }
  return ops
}

/** Every file that differs between two snapshots, sorted by path. */
export function diffTrees(from: FileMap, to: FileMap): FileChange[] {
  const paths = [...new Set([...from.keys(), ...to.keys()])].sort()
  const changes: FileChange[] = []
  for (const path of paths) {
    const oldContent = from.get(path)
    const newContent = to.get(path)
    if (oldContent === newContent) continue
    if (oldContent === undefined) changes.push({ path, kind: 'added', newContent })
    else if (newContent === undefined) changes.push({ path, kind: 'deleted', oldContent })
    else changes.push({ path, kind: 'modified', oldContent, newContent })
  }
  return changes
}

export function countChanges(change: FileChange): { insertions: number; deletions: number } {
  let insertions = 0
  let deletions = 0
  for (const op of diffLines(
    splitLines(change.oldContent ?? ''),
    splitLines(change.newContent ?? ''),
  )) {
    if (op.type === 'insert') insertions++
    else if (op.type === 'delete') deletions++
  }
  return { insertions, deletions }
}

const CONTEXT = 3

function rangeText(start: number, length: number): string {
  return length === 1 ? `${start}` : `${start},${length}`
}

function formatHunks(ops: LineOp[]): string[] {
  const changed = ops.flatMap((op, index) => (op.type === 'equal' ? [] : [index]))
  if (changed.length === 0) return []

  // Group change indices into hunks whose context windows overlap.
  const groups: Array<[number, number]> = []
  for (const index of changed) {
    const last = groups.at(-1)
    if (last && index - last[1] <= CONTEXT * 2) last[1] = index
    else groups.push([index, index])
  }

  const out: string[] = []
  for (const [first, last] of groups) {
    const start = Math.max(0, first - CONTEXT)
    const end = Math.min(ops.length - 1, last + CONTEXT)
    let oldBefore = 0
    let newBefore = 0
    for (let k = 0; k < start; k++) {
      if (ops[k].type !== 'insert') oldBefore++
      if (ops[k].type !== 'delete') newBefore++
    }
    const slice = ops.slice(start, end + 1)
    const oldLength = slice.filter((op) => op.type !== 'insert').length
    const newLength = slice.filter((op) => op.type !== 'delete').length
    const oldStart = oldLength === 0 ? oldBefore : oldBefore + 1
    const newStart = newLength === 0 ? newBefore : newBefore + 1
    out.push(`@@ -${rangeText(oldStart, oldLength)} +${rangeText(newStart, newLength)} @@`)
    for (const op of slice) {
      out.push(`${op.type === 'equal' ? ' ' : op.type === 'delete' ? '-' : '+'}${op.line}`)
    }
  }
  return out
}

/** Unified diff text in the style of `git diff`. */
export function formatUnifiedDiff(changes: FileChange[]): string {
  const out: string[] = []
  for (const change of changes) {
    const { path, kind } = change
    const oldId = change.oldContent === undefined ? '0000000' : shortId(blobId(change.oldContent))
    const newId = change.newContent === undefined ? '0000000' : shortId(blobId(change.newContent))
    out.push(`diff --git a/${path} b/${path}`)
    if (kind === 'added') out.push('new file mode 100644', `index ${oldId}..${newId}`)
    else if (kind === 'deleted') out.push('deleted file mode 100644', `index ${oldId}..${newId}`)
    else out.push(`index ${oldId}..${newId} 100644`)

    const hunks = formatHunks(
      diffLines(splitLines(change.oldContent ?? ''), splitLines(change.newContent ?? '')),
    )
    if (hunks.length === 0) continue
    out.push(kind === 'added' ? '--- /dev/null' : `--- a/${path}`)
    out.push(kind === 'deleted' ? '+++ /dev/null' : `+++ b/${path}`)
    out.push(...hunks)
  }
  return out.join('\n')
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** " 2 files changed, 3 insertions(+), 1 deletion(-)" */
export function formatSummaryLine(changes: FileChange[]): string {
  let insertions = 0
  let deletions = 0
  for (const change of changes) {
    const counts = countChanges(change)
    insertions += counts.insertions
    deletions += counts.deletions
  }
  const parts = [` ${changes.length} file${changes.length === 1 ? '' : 's'} changed`]
  if (insertions > 0 || deletions === 0) parts.push(`${plural(insertions, 'insertion')}(+)`)
  if (deletions > 0 || insertions === 0) parts.push(`${plural(deletions, 'deletion')}(-)`)
  return parts.join(', ')
}

/** Per-file "path | 3 ++-" lines followed by the summary line, as `git merge` prints. */
export function formatDiffstat(changes: FileChange[]): string {
  if (changes.length === 0) return ''
  const width = Math.max(...changes.map((c) => c.path.length))
  const lines = changes.map((change) => {
    const { insertions, deletions } = countChanges(change)
    const total = insertions + deletions
    return ` ${change.path.padEnd(width)} | ${total} ${'+'.repeat(insertions)}${'-'.repeat(deletions)}`.trimEnd()
  })
  return [...lines, formatSummaryLine(changes)].join('\n')
}

export type Merge3Result = { ok: true; content: string } | { ok: false }

function joinLines(lines: string[]): string {
  return lines.length === 0 ? '' : `${lines.join('\n')}\n`
}

function sameLines(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i])
}

/**
 * Line-based three-way merge (diff3). Changes to different parts of a file combine cleanly;
 * different changes to the same lines are a conflict.
 */
export function merge3(base: string, ours: string, theirs: string): Merge3Result {
  if (ours === theirs) return { ok: true, content: ours }
  if (base === ours) return { ok: true, content: theirs }
  if (base === theirs) return { ok: true, content: ours }

  const b = splitLines(base)
  const o = splitLines(ours)
  const t = splitLines(theirs)
  const toOurs = new Map(lcsMatches(b, o))
  const toTheirs = new Map(lcsMatches(b, t))
  const result: string[] = []

  let bi = 0
  let oi = 0
  let ti = 0
  while (bi <= b.length) {
    // Find the next base line that is unchanged on both sides (or the end of the file).
    let sync = bi
    while (sync < b.length && !(toOurs.has(sync) && toTheirs.has(sync))) sync++
    const oEnd = sync < b.length ? toOurs.get(sync)! : o.length
    const tEnd = sync < b.length ? toTheirs.get(sync)! : t.length

    const baseChunk = b.slice(bi, sync)
    const oursChunk = o.slice(oi, oEnd)
    const theirsChunk = t.slice(ti, tEnd)
    if (sameLines(oursChunk, baseChunk)) result.push(...theirsChunk)
    else if (sameLines(theirsChunk, baseChunk) || sameLines(oursChunk, theirsChunk))
      result.push(...oursChunk)
    else return { ok: false }

    if (sync >= b.length) break
    result.push(b[sync])
    bi = sync + 1
    oi = oEnd + 1
    ti = tEnd + 1
  }
  return { ok: true, content: joinLines(result) }
}
