import { describe, expect, it } from 'vitest'
import { checkoutCommand } from '../../src/engine/commands/checkout'
import { fetchCommand } from '../../src/engine/commands/fetch'
import { logCommand } from '../../src/engine/commands/log'
import { pullCommand } from '../../src/engine/commands/pull'
import { pushCommand } from '../../src/engine/commands/push'
import { remoteCommand } from '../../src/engine/commands/remote'
import { statusCommand } from '../../src/engine/commands/status'
import { headCommitId, headTree } from '../../src/engine/repo'
import { commitFiles, fail, run, withCommit } from './helpers'
import { cloned, teammatePushes, URL, worldWithServer } from './remoteHelpers'

// Step 16: `git push`, `git pull`, `git fetch`.
describe('git push', () => {
  it("updates the remote's branch and the local origin/main ref", () => {
    const world = commitFiles(cloned(), { 'a.txt': 'a\n' }, 'Add a')
    const tip = headCommitId(world.repo)!
    const before = world.repo.remoteBranches.get('origin/main')!
    const { world: after, output } = run(world, pushCommand)

    const server = after.servers.get(URL)!
    expect(server.branches.get('main')).toBe(tip)
    expect(server.commits.has(tip)).toBe(true)
    expect(after.repo.remoteBranches.get('origin/main')).toBe(tip)
    expect(output).toBe(`To ${URL}\n   ${before.slice(0, 7)}..${tip.slice(0, 7)}  main -> main`)
  })

  it('says everything is up to date when there is nothing to push', () => {
    expect(run(cloned(), pushCommand).output).toBe('Everything up-to-date')
  })

  it('needs -u the first time a new branch is pushed, then remembers it', () => {
    let world = run(cloned(), checkoutCommand, '-b', 'feature').world
    world = commitFiles(world, { 'f.txt': 'f\n' }, 'Feature')
    expect(fail(world, pushCommand).message).toMatch(
      /^fatal: The current branch feature has no upstream branch\./,
    )

    const { world: after, output } = run(world, pushCommand, '-u', 'origin', 'feature')
    expect(output).toBe(
      `To ${URL}\n * [new branch]      feature -> feature\nbranch 'feature' set up to track 'origin/feature'.`,
    )
    expect(after.servers.get(URL)!.branches.has('feature')).toBe(true)
    expect(after.repo.upstreams.get('feature')).toEqual({ remote: 'origin', branch: 'feature' })
    expect(run(commitFiles(after, { 'f.txt': 'g\n' }, 'More'), pushCommand).output).toMatch(
      /feature -> feature$/,
    )
  })

  it('rejects a non-fast-forward push the way real git does', () => {
    let world = cloned()
    world = teammatePushes(world, { 'theirs.txt': 't\n' }, 'Teammate work')
    world = commitFiles(world, { 'mine.txt': 'm\n' }, 'My work')
    const serverTip = world.servers.get(URL)!.branches.get('main')

    const error = fail(world, pushCommand)
    expect(error.message).toMatch(
      new RegExp(`^To ${URL}\n ! \\[rejected\\]        main -> main \\(fetch first\\)`),
    )
    expect(error.message).toContain(`error: failed to push some refs to '${URL}'`)
    expect(world.servers.get(URL)!.branches.get('main')).toBe(serverTip)

    // After fetching, git knows the remote commit and calls it non-fast-forward instead.
    const fetched = run(world, fetchCommand).world
    expect(fail(fetched, pushCommand).message).toContain('(non-fast-forward)')
  })

  it('pushes a new repository to an empty remote', () => {
    let world = withCommit({ 'a.txt': 'a\n' })
    const server = worldWithServer().servers.get(URL)!
    server.commits.clear()
    server.branches.clear()
    world = { ...world, servers: new Map([[URL, server]]) }
    world = run(world, remoteCommand, 'add', 'origin', URL).world
    const { world: after } = run(world, pushCommand, '-u', 'origin', 'main')
    expect(after.servers.get(URL)!.branches.get('main')).toBe(headCommitId(world.repo))
    expect(after.servers.get(URL)!.HEAD).toEqual({ type: 'branch', ref: 'main' })
  })

  it('errors without a remote', () => {
    expect(fail(withCommit(), pushCommand).message).toMatch(
      /^fatal: No configured push destination\./,
    )
    expect(fail(cloned(), pushCommand, 'upstream', 'main').message).toMatch(
      /^fatal: 'upstream' does not appear to be a git repository/,
    )
  })
})

describe('git fetch', () => {
  it('downloads new commits into origin/main without touching local branches', () => {
    const world = teammatePushes(cloned(), { 'new.txt': 'n\n' }, 'Teammate work')
    const localTip = headCommitId(world.repo)
    const serverTip = world.servers.get(URL)!.branches.get('main')!

    const { world: after, output } = run(world, fetchCommand)
    expect(after.repo.remoteBranches.get('origin/main')).toBe(serverTip)
    expect(after.repo.commits.has(serverTip)).toBe(true)
    expect(after.repo.branches.get('main')).toBe(localTip)
    expect(after.repo.workingDirectory.has('new.txt')).toBe(false)
    expect(output).toBe(
      `From ${URL}\n   ${localTip!.slice(0, 7)}..${serverTip.slice(0, 7)}  main       -> origin/main`,
    )
    expect(run(after, statusCommand).output).toContain(
      "Your branch is behind 'origin/main' by 1 commit, and can be fast-forwarded.",
    )
    expect(run(after, fetchCommand).output).toBe('')
  })

  it('reports new remote branches', () => {
    let teammateWorld = cloned()
    teammateWorld = run(teammateWorld, checkoutCommand, '-b', 'feature').world
    teammateWorld = commitFiles(teammateWorld, { 'f.txt': 'f\n' }, 'Feature')
    teammateWorld = run(teammateWorld, pushCommand, '-u', 'origin', 'feature').world

    const player = { ...cloned(), servers: teammateWorld.servers, clock: teammateWorld.clock }
    const { world: after, output } = run(player, fetchCommand)
    expect(output).toContain(' * [new branch]      feature    -> origin/feature')
    // checkout of a name that only exists on the remote creates a tracking branch.
    const checkedOut = run(after, checkoutCommand, 'feature')
    expect(checkedOut.output).toBe(
      "branch 'feature' set up to track 'origin/feature'.\nSwitched to a new branch 'feature'\nYour branch is up to date with 'origin/feature'.",
    )
  })
})

describe('git pull', () => {
  it('fetches and fast-forwards when only the remote has new commits', () => {
    const world = teammatePushes(cloned(), { 'new.txt': 'n\n' }, 'Teammate work')
    const serverTip = world.servers.get(URL)!.branches.get('main')!
    const { world: after, output } = run(world, pullCommand)
    expect(after.repo.branches.get('main')).toBe(serverTip)
    expect(after.repo.workingDirectory.get('new.txt')).toBe('n\n')
    expect(output).toContain(`From ${URL}`)
    expect(output).toContain('Fast-forward')
  })

  it('creates a merge commit when both sides have new commits', () => {
    let world = teammatePushes(cloned(), { 'theirs.txt': 't\n' }, 'Teammate work')
    world = commitFiles(world, { 'mine.txt': 'm\n' }, 'My work')
    const { world: after } = run(world, pullCommand)
    const merge = after.repo.commits.get(headCommitId(after.repo)!)!
    expect(merge.parents).toHaveLength(2)
    expect(merge.message).toBe(`Merge branch 'main' of ${URL}`)
    expect(headTree(after.repo).get('theirs.txt')).toBe('t\n')
    expect(headTree(after.repo).get('mine.txt')).toBe('m\n')
    // And now the push goes through.
    expect(run(after, pushCommand).world.servers.get(URL)!.branches.get('main')).toBe(
      headCommitId(after.repo),
    )
    expect(run(after, logCommand, '--oneline').output.split('\n')).toHaveLength(4)
  })

  it('needs tracking information or an explicit remote and branch', () => {
    const world = run(cloned(), checkoutCommand, '-b', 'feature').world
    expect(fail(world, pullCommand).message).toMatch(
      /^There is no tracking information for the current branch\./,
    )
    expect(run(world, pullCommand, 'origin', 'main').output).toBe('Already up to date.')
  })

  it("errors when the remote branch doesn't exist", () => {
    expect(fail(cloned(), pullCommand, 'origin', 'nope').message).toBe(
      "fatal: couldn't find remote ref nope",
    )
  })
})
