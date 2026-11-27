import { diffTrees, type ChangeKind } from './diff'
import { aheadBehind } from './graph'
import { loadIgnoreRules, isIgnored } from './ignore'
import { headTree } from './repo'
import type { Repo } from './types'

export interface StatusEntry {
  path: string
  kind: ChangeKind
}

export interface RepoStatus {
  /** Index vs. HEAD: what the next commit would change. */
  staged: StatusEntry[]
  /** Working directory vs. index, for tracked files. */
  unstaged: StatusEntry[]
  /** Files in the working directory that git is not tracking (ignored files excluded). */
  untracked: string[]
}

export function computeStatus(repo: Repo): RepoStatus {
  const staged = diffTrees(headTree(repo), repo.stagingArea).map(({ path, kind }) => ({
    path,
    kind,
  }))
  const unstaged: StatusEntry[] = []
  for (const [path, content] of [...repo.stagingArea].sort(([a], [b]) => a.localeCompare(b))) {
    const working = repo.workingDirectory.get(path)
    if (working === undefined) unstaged.push({ path, kind: 'deleted' })
    else if (working !== content) unstaged.push({ path, kind: 'modified' })
  }
  const rules = loadIgnoreRules(repo.workingDirectory)
  const untracked = [...repo.workingDirectory.keys()]
    .filter((path) => !repo.stagingArea.has(path) && !isIgnored(path, rules))
    .sort()
  return { staged, unstaged, untracked }
}

export function isWorkingTreeClean(repo: Repo): boolean {
  const status = computeStatus(repo)
  return status.staged.length === 0 && status.unstaged.length === 0 && status.untracked.length === 0
}

function commits(n: number): string {
  return `${n} commit${n === 1 ? '' : 's'}`
}

/** "Your branch is ahead of 'origin/main' by 1 commit." and friends; '' when not tracking. */
export function trackingSummary(repo: Repo, branch: string): string {
  const upstream = repo.upstreams.get(branch)
  const local = repo.branches.get(branch)
  if (!upstream || !local) return ''
  const name = `${upstream.remote}/${upstream.branch}`
  const remote = repo.remoteBranches.get(name)
  if (!remote) {
    return `Your branch is based on '${name}', but the upstream is gone.\n  (use "git branch --unset-upstream" to fixup)`
  }
  const { ahead, behind } = aheadBehind(repo, local, remote)
  if (ahead === 0 && behind === 0) return `Your branch is up to date with '${name}'.`
  if (behind === 0) {
    return `Your branch is ahead of '${name}' by ${commits(ahead)}.\n  (use "git push" to publish your local commits)`
  }
  if (ahead === 0) {
    return `Your branch is behind '${name}' by ${commits(behind)}, and can be fast-forwarded.\n  (use "git pull" to update your local branch)`
  }
  return `Your branch and '${name}' have diverged,\nand have ${ahead} and ${behind} different commits each, respectively.\n  (use "git pull" if you want to integrate the remote branch with yours)`
}
