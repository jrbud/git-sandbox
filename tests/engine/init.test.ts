import { describe, expect, it } from 'vitest'
import { initCommand } from '../../src/engine/commands/init'
import { statusCommand } from '../../src/engine/commands/status'
import { createWorld } from '../../src/engine/repo'
import { fail, run, write } from './helpers'

// Step 2: empty-repo factory and `git init`.
describe('createWorld', () => {
  it('starts with an uninitialized, empty repository', () => {
    const world = createWorld()
    expect(world.repo.initialized).toBe(false)
    expect(world.repo.commits.size).toBe(0)
    expect(world.repo.branches.size).toBe(0)
    expect(world.repo.workingDirectory.size).toBe(0)
  })
})

describe('git init', () => {
  it('creates a repository with no commits, an unborn main branch and an empty folder', () => {
    const { world, output } = run(createWorld(), initCommand)
    expect(output).toBe('Initialized empty Git repository in /project/.git/')
    expect(world.repo.initialized).toBe(true)
    expect(world.repo.commits.size).toBe(0)
    expect(world.repo.branches.has('main')).toBe(false)
    expect(world.repo.HEAD).toEqual({ type: 'branch', ref: 'main' })
    expect(world.repo.workingDirectory.size).toBe(0)
    expect(world.repo.stagingArea.size).toBe(0)
  })

  it('keeps files that were already in the folder', () => {
    const before = write(createWorld(), { 'notes.txt': 'hi\n' })
    const { world } = run(before, initCommand)
    expect(world.repo.workingDirectory.get('notes.txt')).toBe('hi\n')
    expect(world.repo.stagingArea.size).toBe(0)
  })

  it('reports reinitializing an existing repository without changing it', () => {
    const first = run(createWorld(), initCommand).world
    const second = run(first, initCommand)
    expect(second.output).toBe('Reinitialized existing Git repository in /project/.git/')
    expect(second.world.repo).toEqual(first.repo)
  })

  it('does not modify the world it was given', () => {
    const before = createWorld()
    run(before, initCommand)
    expect(before.repo.initialized).toBe(false)
  })

  it('makes other commands fail with "not a git repository" until it runs', () => {
    const error = fail(createWorld(), statusCommand)
    expect(error.message).toBe(
      'fatal: not a git repository (or any of the parent directories): .git',
    )
    expect(error.explanation).toMatch(/git init/)
  })
})
