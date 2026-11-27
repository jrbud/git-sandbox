import { describe, expect, it } from 'vitest'
import { cloneCommand } from '../../src/engine/commands/clone'
import { remoteCommand } from '../../src/engine/commands/remote'
import { statusCommand } from '../../src/engine/commands/status'
import { headCommitId } from '../../src/engine/repo'
import { fail, initialized, run, write } from './helpers'
import { cloned, teammatePushes, URL, worldWithServer } from './remoteHelpers'

// Step 15: `git remote add` and `git clone`.
describe('git remote', () => {
  it('adds, lists and removes remotes', () => {
    let world = run(initialized(), remoteCommand, 'add', 'origin', URL).world
    expect(world.repo.remotes.get('origin')).toEqual({ name: 'origin', url: URL })
    expect(run(world, remoteCommand).output).toBe('origin')
    expect(run(world, remoteCommand, '-v').output).toBe(
      `origin\t${URL} (fetch)\norigin\t${URL} (push)`,
    )
    world = run(world, remoteCommand, 'remove', 'origin').world
    expect(world.repo.remotes.size).toBe(0)
  })

  it('rejects a duplicate name, missing arguments and unknown remotes', () => {
    const world = run(initialized(), remoteCommand, 'add', 'origin', URL).world
    expect(fail(world, remoteCommand, 'add', 'origin', URL).message).toBe(
      'error: remote origin already exists.',
    )
    expect(fail(world, remoteCommand, 'add', 'origin').message).toBe(
      'usage: git remote add <name> <url>',
    )
    expect(fail(world, remoteCommand, 'rm', 'upstream').message).toBe(
      "error: No such remote: 'upstream'",
    )
  })
})

describe('git clone', () => {
  it('copies the full history, checks out the default branch and sets up origin', () => {
    const world = worldWithServer({ 'README.md': 'hello\n', 'src/app.js': 'app\n' })
    const server = world.servers.get(URL)!
    const { world: after, output } = run(world, cloneCommand, URL)
    const repo = after.repo

    expect(output).toBe("Cloning into 'project'...\ndone.")
    expect(repo.initialized).toBe(true)
    expect([...repo.commits.keys()]).toEqual([...server.commits.keys()])
    expect(repo.branches.get('main')).toBe(server.branches.get('main'))
    expect(repo.remoteBranches.get('origin/main')).toBe(server.branches.get('main'))
    expect(repo.remotes.get('origin')).toEqual({ name: 'origin', url: URL })
    expect(repo.upstreams.get('main')).toEqual({ remote: 'origin', branch: 'main' })
    expect(repo.workingDirectory.get('src/app.js')).toBe('app\n')
    expect(run(after, statusCommand).output).toBe(
      "On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean",
    )
  })

  it('is independent of the source: later changes to the server do not leak in', () => {
    const world = cloned()
    const tipAtClone = headCommitId(world.repo)
    const later = teammatePushes(world, { 'new.txt': 'n\n' }, 'Teammate work')
    expect(later.servers.get(URL)!.branches.get('main')).not.toBe(tipAtClone)
    expect(later.repo.branches.get('main')).toBe(tipAtClone)
    expect(later.repo.commits.size).toBe(1)
  })

  it('warns when cloning an empty repository', () => {
    const world = worldWithServer()
    const server = world.servers.get(URL)!
    server.commits.clear()
    server.branches.clear()
    const { world: after, output } = run(world, cloneCommand, URL)
    expect(output).toBe(
      "Cloning into 'project'...\nwarning: You appear to have cloned an empty repository.",
    )
    expect(after.repo.initialized).toBe(true)
    expect(after.repo.branches.size).toBe(0)
  })

  it('errors on an unknown URL, a missing URL, or a folder that is not empty', () => {
    expect(fail(worldWithServer(), cloneCommand, 'https://example.com/nope.git').message).toBe(
      "Cloning into 'nope'...\nremote: Repository not found.\nfatal: repository 'https://example.com/nope.git' not found",
    )
    expect(fail(worldWithServer(), cloneCommand).message).toBe(
      'fatal: You must specify a repository to clone.',
    )
    expect(fail(write(worldWithServer(), { 'x.txt': 'x' }), cloneCommand, URL).message).toMatch(
      /already exists and is not an empty directory/,
    )
  })
})
