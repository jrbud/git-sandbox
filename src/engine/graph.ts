import type { Commit, CommitId, Repo } from './types'

/** Every commit reachable from `starts`, including the starts themselves. */
export function ancestors(repo: Repo, ...starts: CommitId[]): Set<CommitId> {
  const seen = new Set<CommitId>()
  const stack = [...starts]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    const commit = repo.commits.get(id)
    if (!commit) continue
    seen.add(id)
    stack.push(...commit.parents)
  }
  return seen
}

/** True when `ancestor` is `descendant` or one of its ancestors. */
export function isAncestor(repo: Repo, ancestor: CommitId, descendant: CommitId): boolean {
  return ancestors(repo, descendant).has(ancestor)
}

function newestFirst(a: Commit, b: Commit): number {
  return b.timestamp - a.timestamp || a.id.localeCompare(b.id)
}

/**
 * The best common ancestor of two commits: a shared ancestor that no other shared ancestor
 * descends from. If there are several, the newest is chosen so results stay deterministic.
 */
export function mergeBase(repo: Repo, a: CommitId, b: CommitId): CommitId | undefined {
  const fromB = ancestors(repo, b)
  const common = [...ancestors(repo, a)].filter((id) => fromB.has(id))
  const best = common.filter(
    (candidate) =>
      !common.some((other) => other !== candidate && isAncestor(repo, candidate, other)),
  )
  return best.map((id) => repo.commits.get(id)!).sort(newestFirst)[0]?.id
}

/** Reachable commits ordered newest first, like `git log`. */
export function commitsInLogOrder(repo: Repo, starts: CommitId[]): Commit[] {
  return [...ancestors(repo, ...starts)].map((id) => repo.commits.get(id)!).sort(newestFirst)
}

/** How many commits `a` has that `b` lacks (ahead), and the reverse (behind). */
export function aheadBehind(
  repo: Repo,
  a: CommitId,
  b: CommitId,
): { ahead: number; behind: number } {
  const fromA = ancestors(repo, a)
  const fromB = ancestors(repo, b)
  return {
    ahead: [...fromA].filter((id) => !fromB.has(id)).length,
    behind: [...fromB].filter((id) => !fromA.has(id)).length,
  }
}
