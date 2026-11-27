import type { CommandDefinition } from '../command'
import { GitError } from '../errors'
import { isAncestor } from '../graph'
import { shortId } from '../hash'
import { currentBranch, headCommitId, isValidBranchName, REPO_PATH, resolveRevision } from '../repo'
import type { CommitId, Repo } from '../types'

export function invalidBranchNameError(name: string): GitError {
  return new GitError(
    `fatal: '${name}' is not a valid branch name`,
    'Branch names cannot contain spaces or characters like ~ ^ : ? * [ and cannot start with a dash.',
  )
}

export function branchExistsError(name: string): GitError {
  return new GitError(
    `fatal: a branch named '${name}' already exists`,
    `There's already a branch called '${name}'. Pick a different name, or switch to it instead.`,
  )
}

/** If `start` is a remote-tracking branch like origin/main, return its remote and branch. */
export function remoteTrackingParts(
  repo: Repo,
  start: string,
): { remote: string; branch: string } | undefined {
  const name = start.startsWith('remotes/') ? start.slice('remotes/'.length) : start
  if (!repo.remoteBranches.has(name) || repo.branches.has(start)) return undefined
  const slash = name.indexOf('/')
  return { remote: name.slice(0, slash), branch: name.slice(slash + 1) }
}

/**
 * Create a branch at a start point, as `git branch`, `checkout -b` and `switch -c` do.
 * Returns the "set up to track" line when the start point is a remote-tracking branch.
 */
export function createBranch(
  repo: Repo,
  name: string,
  startPoint: string | undefined,
): { id: CommitId; tracking: string } {
  if (!isValidBranchName(name)) throw invalidBranchNameError(name)
  if (repo.branches.has(name)) throw branchExistsError(name)
  const start = startPoint ?? 'HEAD'
  const id = resolveRevision(repo, start)
  if (!id) {
    const shown = startPoint ?? currentBranch(repo) ?? 'HEAD'
    throw new GitError(
      `fatal: not a valid object name: '${shown}'`,
      startPoint
        ? `There's no branch or commit called '${startPoint}'.`
        : 'A branch has to point at a commit, and there are no commits yet. Make your first commit, then create the branch.',
    )
  }
  repo.branches.set(name, id)
  let tracking = ''
  if (startPoint) {
    const upstream = remoteTrackingParts(repo, startPoint)
    if (upstream) {
      repo.upstreams.set(name, upstream)
      tracking = `branch '${name}' set up to track '${upstream.remote}/${upstream.branch}'.`
    }
  }
  return { id, tracking }
}

function listBranches(repo: Repo, locals: boolean, remotes: boolean, remotePrefix: string): string {
  const lines: string[] = []
  const branch = currentBranch(repo)
  const head = headCommitId(repo)
  if (locals) {
    if (!branch && head) lines.push(`* (HEAD detached at ${shortId(head)})`)
    for (const name of [...repo.branches.keys()].sort()) {
      lines.push(`${name === branch ? '*' : ' '} ${name}`)
    }
  }
  if (remotes) {
    for (const name of [...repo.remoteBranches.keys()].sort())
      lines.push(`  ${remotePrefix}${name}`)
  }
  return lines.join('\n')
}

export const branchCommand: CommandDefinition = {
  name: 'branch',
  summary: 'List, create or delete branches',
  flags: {
    '-d': { aliases: ['--delete'] },
    '-D': {},
    '-a': { aliases: ['--all'] },
    '-r': { aliases: ['--remotes'] },
    '-u': { takesValue: true, aliases: ['--set-upstream-to'] },
  },
  requiresRepo: true,
  run(world, args) {
    const repo = world.repo
    const [name, start] = args.positionals

    if (args.has('-d') || args.has('-D')) {
      if (!name) {
        throw new GitError(
          'fatal: branch name required',
          'Say which branch to delete, like git branch -d feature.',
          'usage',
        )
      }
      const out: string[] = []
      for (const target of args.positionals) {
        const id = repo.branches.get(target)
        if (id === undefined) {
          throw new GitError(
            `error: branch '${target}' not found`,
            `There's no branch called '${target}'.`,
          )
        }
        if (target === currentBranch(repo)) {
          throw new GitError(
            `error: cannot delete branch '${target}' used by worktree at '${REPO_PATH}'`,
            "You can't delete the branch you're on. Switch to another branch first.",
          )
        }
        const head = headCommitId(repo)
        if (!args.has('-D') && !(head && isAncestor(repo, id, head))) {
          throw new GitError(
            `error: the branch '${target}' is not fully merged.\nhint: If you are sure you want to delete it, run 'git branch -D ${target}'`,
            `'${target}' has commits that aren't on your current branch, so deleting it could lose work. Merge it first, or use -D to delete it anyway.`,
          )
        }
        repo.branches.delete(target)
        repo.upstreams.delete(target)
        out.push(`Deleted branch ${target} (was ${shortId(id)}).`)
      }
      return out.join('\n')
    }

    if (args.has('-u')) {
      const upstreamName = args.value('-u')!
      const target = name ?? currentBranch(repo)
      const upstream = remoteTrackingParts(repo, upstreamName)
      if (!target || !repo.branches.has(target)) {
        throw new GitError(
          `fatal: branch '${target ?? 'HEAD'}' does not exist`,
          'Pick an existing local branch.',
        )
      }
      if (!upstream) {
        throw new GitError(
          `fatal: the requested upstream branch '${upstreamName}' does not exist`,
          `There's no remote branch called '${upstreamName}'. Run git fetch first, or check the name with git branch -r.`,
        )
      }
      repo.upstreams.set(target, upstream)
      return `branch '${target}' set up to track '${upstream.remote}/${upstream.branch}'.`
    }

    if (!name) {
      if (args.has('-a')) return listBranches(repo, true, true, 'remotes/')
      if (args.has('-r')) return listBranches(repo, false, true, '')
      return listBranches(repo, true, false, '')
    }
    return createBranch(repo, name, start).tracking
  },
}
