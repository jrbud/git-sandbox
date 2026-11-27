import { describe, expect, it } from 'vitest'
import { configCommand } from '../../src/engine/commands/config'
import { initCommand } from '../../src/engine/commands/init'
import { createWorld, headCommitId } from '../../src/engine/repo'
import { commitFiles, fail, run } from './helpers'

// Step 13: `git config` (simulated user.name / user.email).
describe('git config', () => {
  it('stores values that later commits use as their author', () => {
    let world = run(createWorld(), initCommand).world
    world = run(world, configCommand, 'user.name', 'Sam Lee').world
    world = run(world, configCommand, 'user.email', 'sam@example.com').world
    world = commitFiles(world, { 'a.txt': 'a' }, 'First')
    expect(world.repo.commits.get(headCommitId(world.repo)!)!.author).toEqual({
      name: 'Sam Lee',
      email: 'sam@example.com',
    })
  })

  it('reads values back, with repository config overriding --global', () => {
    let world = run(createWorld(), configCommand, '--global', 'user.name', 'Global Name').world
    world = run(world, initCommand).world
    expect(run(world, configCommand, 'user.name').output).toBe('Global Name')
    world = run(world, configCommand, 'user.name', 'Repo Name').world
    expect(run(world, configCommand, 'user.name').output).toBe('Repo Name')
    expect(run(world, configCommand, '--global', 'user.name').output).toBe('Global Name')
  })

  it('lists settings and treats keys case-insensitively', () => {
    let world = run(createWorld(), configCommand, '--global', 'User.Name', 'Sam').world
    world = run(world, configCommand, '--global', 'user.email', 'sam@example.com').world
    expect(run(world, configCommand, '--list').output).toBe(
      'user.name=Sam\nuser.email=sam@example.com',
    )
  })

  it('only allows --global outside a repository', () => {
    expect(fail(createWorld(), configCommand, 'user.name', 'Sam').message).toBe(
      'fatal: not in a git directory',
    )
    expect(
      run(createWorld(), configCommand, '--global', 'user.name', 'Sam').world.globalConfig.get(
        'user.name',
      ),
    ).toBe('Sam')
  })

  it('rejects keys without a section, and unquoted values with spaces', () => {
    const world = run(createWorld(), initCommand).world
    expect(fail(world, configCommand, 'name', 'Sam').message).toBe(
      'error: key does not contain a section: name',
    )
    expect(fail(world, configCommand, 'user.name', 'Sam', 'Lee').explanation).toMatch(/quotes/)
  })
})
