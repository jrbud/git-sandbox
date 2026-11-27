import { GitError } from './errors'
import { ancestors } from './graph'
import { shortId } from './hash'
import type { CommitId, Remote, Repo, World } from './types'

export function cannotReadRemoteError(name: string): GitError {
  return new GitError(
    [
      `fatal: '${name}' does not appear to be a git repository`,
      'fatal: Could not read from remote repository.',
      '',
      'Please make sure you have the correct access rights',
      'and the repository exists.',
    ].join('\n'),
    `There's no remote called '${name}'. List your remotes with git remote -v, or add one with git remote add.`,
  )
}

export function repositoryNotFoundError(url: string): GitError {
  return new GitError(
    `remote: Repository not found.\nfatal: repository '${url}' not found`,
    `Nothing exists at ${url}. Check the address for typos.`,
  )
}

/** The remote a fetch/pull/push without arguments talks to. */
export function defaultRemoteName(repo: Repo): string | undefined {
  const branch = repo.HEAD.type === 'branch' ? repo.HEAD.ref : undefined
  const upstream = branch ? repo.upstreams.get(branch) : undefined
  if (upstream) return upstream.remote
  if (repo.remotes.has('origin')) return 'origin'
  return undefined
}

export function requireRemote(world: World, name: string): { remote: Remote; server: Repo } {
  const remote = world.repo.remotes.get(name)
  if (!remote) throw cannotReadRemoteError(name)
  const server = world.servers.get(remote.url)
  if (!server) throw repositoryNotFoundError(remote.url)
  return { remote, server }
}

/** Copy every commit reachable from `tips` that `to` does not have yet. */
export function copyCommits(from: Repo, to: Repo, tips: CommitId[]): void {
  for (const id of ancestors(from, ...tips)) {
    if (!to.commits.has(id)) to.commits.set(id, structuredClone(from.commits.get(id)!))
  }
}

/** "   a1b2c3d..e4f5a6b  main       -> origin/main" style ref-update line. */
export function refUpdateLine(
  oldId: CommitId | undefined,
  newId: CommitId,
  from: string,
  to: string,
  forced = false,
): string {
  const summary =
    oldId === undefined
      ? ' * [new branch]     '
      : forced
        ? ` + ${shortId(oldId)}...${shortId(newId)}`
        : `   ${shortId(oldId)}..${shortId(newId)} `
  return `${summary} ${from.padEnd(10)} -> ${to}${forced ? '  (forced update)' : ''}`
}
