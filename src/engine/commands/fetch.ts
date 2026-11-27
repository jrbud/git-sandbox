import type { CommandDefinition } from '../command'
import { GitError } from '../errors'
import { isAncestor } from '../graph'
import { copyCommits, defaultRemoteName, refUpdateLine, requireRemote } from '../remotes'
import type { World } from '../types'

export function noRemoteSpecifiedError(): GitError {
  return new GitError(
    'fatal: No remote repository specified.  Please, specify either a URL or a\nremote name from which new revisions should be fetched.',
    "This repository doesn't have any remotes yet. Add one with git remote add origin <url>.",
  )
}

/** Download new commits and update remote-tracking refs. Returns fetch output ('' if nothing new). */
export function fetchRemote(world: World, remoteName: string): string {
  const repo = world.repo
  const { remote, server } = requireRemote(world, remoteName)
  copyCommits(server, repo, [...server.branches.values()])

  const lines: string[] = []
  for (const branch of [...server.branches.keys()].sort()) {
    const id = server.branches.get(branch)!
    const ref = `${remoteName}/${branch}`
    const old = repo.remoteBranches.get(ref)
    if (old === id) continue
    const forced = old !== undefined && !isAncestor(repo, old, id)
    lines.push(refUpdateLine(old, id, branch, ref, forced))
    repo.remoteBranches.set(ref, id)
  }
  return lines.length > 0 ? [`From ${remote.url}`, ...lines].join('\n') : ''
}

export const fetchCommand: CommandDefinition = {
  name: 'fetch',
  summary: 'Download new commits from a remote without changing your branches',
  flags: {},
  requiresRepo: true,
  run(world, args) {
    const name = args.positionals[0] ?? defaultRemoteName(world.repo)
    if (name === undefined) {
      if (world.repo.remotes.size === 0) throw noRemoteSpecifiedError()
      throw new GitError(
        'fatal: No remote repository specified.',
        'Say which remote to fetch from, like git fetch origin.',
        'usage',
      )
    }
    return fetchRemote(world, name)
  },
}
