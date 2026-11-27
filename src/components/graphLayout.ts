import { commitsInLogOrder } from '../engine/graph'
import { currentBranch, headCommitId } from '../engine/repo'
import type { CommitId, Repo } from '../engine/types'

export interface GraphRef {
  name: string
  kind: 'branch' | 'remote'
  /** The branch HEAD is attached to. */
  current: boolean
}

export interface GraphNode {
  id: CommitId
  message: string
  /** 0 = oldest commit, increasing to the right. */
  column: number
  /** Horizontal track; each branch line gets its own lane. */
  lane: number
  refs: GraphRef[]
  isHead: boolean
  isMerge: boolean
}

export interface GraphEdge {
  from: CommitId
  to: CommitId
  fromColumn: number
  fromLane: number
  toColumn: number
  toLane: number
}

export interface GraphLayout {
  nodes: GraphNode[]
  edges: GraphEdge[]
  laneCount: number
}

/** main/master first, then the checked-out branch, other branches, then remote-tracking refs. */
function tipOrder(repo: Repo): CommitId[] {
  const branch = currentBranch(repo)
  const locals = [...repo.branches.keys()].sort((a, b) => {
    const rank = (name: string) =>
      name === 'main' || name === 'master' ? 0 : name === branch ? 1 : 2
    return rank(a) - rank(b) || a.localeCompare(b)
  })
  const tips = locals.map((name) => repo.branches.get(name)!)
  const head = headCommitId(repo)
  if (head) tips.push(head)
  tips.push(...[...repo.remoteBranches.keys()].sort().map((name) => repo.remoteBranches.get(name)!))
  return tips
}

/**
 * Lay out every commit reachable from a branch, remote-tracking ref or HEAD. Each tip claims a
 * lane and follows its first-parent chain until it meets a commit that already has one, so
 * main stays a straight line and branches sit on their own tracks.
 */
export function layoutGraph(repo: Repo): GraphLayout {
  const tips = tipOrder(repo)
  const newestFirst = commitsInLogOrder(repo, tips)
  const lanes = new Map<CommitId, number>()
  let laneCount = 0

  const claim = (start: CommitId) => {
    if (lanes.has(start)) return
    const lane = laneCount++
    let id: CommitId | undefined = start
    while (id !== undefined && !lanes.has(id) && repo.commits.has(id)) {
      lanes.set(id, lane)
      id = repo.commits.get(id)!.parents[0]
    }
  }
  tips.forEach(claim)
  newestFirst.forEach((commit) => claim(commit.id))

  const oldestFirst = [...newestFirst].reverse()
  const column = new Map(oldestFirst.map((commit, index) => [commit.id, index]))
  const branch = currentBranch(repo)
  const head = headCommitId(repo)

  const nodes: GraphNode[] = oldestFirst.map((commit) => ({
    id: commit.id,
    message: commit.message.split('\n')[0],
    column: column.get(commit.id)!,
    lane: lanes.get(commit.id)!,
    refs: [
      ...[...repo.branches]
        .filter(([, at]) => at === commit.id)
        .map(([name]) => ({ name, kind: 'branch' as const, current: name === branch }))
        .sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name)),
      ...[...repo.remoteBranches]
        .filter(([, at]) => at === commit.id)
        .map(([name]) => ({ name, kind: 'remote' as const, current: false }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ],
    isHead: commit.id === head,
    isMerge: commit.parents.length > 1,
  }))

  const edges: GraphEdge[] = oldestFirst.flatMap((commit) =>
    commit.parents
      .filter((parent) => column.has(parent))
      .map((parent) => ({
        from: commit.id,
        to: parent,
        fromColumn: column.get(commit.id)!,
        fromLane: lanes.get(commit.id)!,
        toColumn: column.get(parent)!,
        toLane: lanes.get(parent)!,
      })),
  )

  return { nodes, edges, laneCount }
}
