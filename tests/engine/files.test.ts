import { describe, expect, it } from 'vitest'
import {
  deleteFile,
  fileMapFromObject,
  fileMapsEqual,
  normalizePath,
  readWorkingFile,
  removeWorkingFile,
  setFile,
  sortedPaths,
  writeWorkingFile,
} from '../../src/engine/files'
import { createWorld } from '../../src/engine/repo'

// Step 3: working directory and staging area as path -> content maps, with helpers.
describe('file map helpers', () => {
  it('normalizes paths', () => {
    expect(normalizePath('./src//app.ts')).toBe('src/app.ts')
    expect(normalizePath('/docs/')).toBe('docs')
    expect(normalizePath('.')).toBe('')
  })

  it('adds, updates and removes files without mutating the original map', () => {
    const empty = new Map<string, string>()
    const added = setFile(empty, 'a.txt', 'one\n')
    const updated = setFile(added, './a.txt', 'two\n')
    const removed = deleteFile(updated, 'a.txt')

    expect(empty.size).toBe(0)
    expect(added.get('a.txt')).toBe('one\n')
    expect(updated.get('a.txt')).toBe('two\n')
    expect(updated.size).toBe(1)
    expect(removed.has('a.txt')).toBe(false)
  })

  it('lists paths in sorted order and compares maps by content', () => {
    const files = fileMapFromObject({ 'b.txt': 'b', 'a/c.txt': 'c', 'a.txt': 'a' })
    expect(sortedPaths(files)).toEqual(['a.txt', 'a/c.txt', 'b.txt'])
    expect(fileMapsEqual(files, new Map(files))).toBe(true)
    expect(fileMapsEqual(files, setFile(files, 'a.txt', 'changed'))).toBe(false)
  })
})

describe('working directory helpers', () => {
  it('write, read and remove files in the player folder', () => {
    const start = createWorld()
    const written = writeWorkingFile(start, 'notes/todo.md', '- learn git\n')
    expect(readWorkingFile(written, 'notes/todo.md')).toBe('- learn git\n')
    expect(readWorkingFile(start, 'notes/todo.md')).toBeUndefined()

    const removed = removeWorkingFile(written, 'notes/todo.md')
    expect(readWorkingFile(removed, 'notes/todo.md')).toBeUndefined()
    expect(removed.repo.stagingArea.size).toBe(0)
  })
})
