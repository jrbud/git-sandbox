import { normalizePath } from './files'
import { ancestors, isAncestor } from './graph'
import { isPathIgnored } from './ignore'
import { currentBranch, getConfig, headCommitId, headTree, resolveRevision, treeOf } from './repo'
import { computeStatus, isWorkingTreeClean } from './status'
import type { World } from './types'

/**
 * Declarative level objectives (spec Section 6). Levels describe success as data, so new
 * levels never need new code as long as they use these checks.
 */
export type Predicate =
  | { all: Predicate[] }
  | { any: Predicate[] }
  | { not: Predicate }
  | { check: 'isInitialized' }
  | { check: 'branchExists'; name: string }
  /** HEAD is attached to (checked out on) this branch. */
  | { check: 'headPointsTo'; ref: string }
  | { check: 'headDetached' }
  /** Commits reachable from a branch (default: HEAD). */
  | { check: 'commitCount'; onBranch?: string; min?: number; max?: number; equals?: number }
  | { check: 'fileInWorkingDirectory'; path: string; content?: string }
  /** The file has a staged change (staging area differs from HEAD for it). */
  | { check: 'fileStaged'; path: string }
  /** The file is in the staging area, i.e. git tracks it. */
  | { check: 'fileTracked'; path: string }
  | { check: 'fileUntracked'; path: string }
  | { check: 'fileIgnored'; path: string }
  /** The file is in the snapshot at the tip of a branch (default: HEAD). */
  | { check: 'fileCommitted'; path: string; onBranch?: string; content?: string }
  | { check: 'workingTreeClean' }
  /** `ref`'s commit is part of `branch`'s history. */
  | { check: 'branchContains'; branch: string; ref: string }
  /** Two refs (branches, remote-tracking refs, HEAD) point at the same commit. */
  | { check: 'refsEqual'; ref: string; other: string }
  | { check: 'isMergeCommit'; ref: string }
  | { check: 'configEquals'; key: string; value?: string; scope?: 'local' | 'global' | 'any' }
  | { check: 'remoteExists'; name: string; url?: string }
  /** The remote server's branch points at the same commit as a local branch. */
  | { check: 'remoteBranchMatches'; remote: string; branch: string; localBranch?: string }
  | { check: 'upstreamIs'; branch: string; remote: string; remoteBranch: string }
  | { check: 'lastCommitMessage'; onBranch?: string; equals?: string; contains?: string }
  /** Who made the latest commit on a branch (default: HEAD). */
  | { check: 'lastCommitAuthor'; onBranch?: string; name?: string; email?: string }

type CheckName = Extract<Predicate, { check: string }>['check']

/** Required string fields for each check, used to validate level files. */
export const PREDICATE_CHECKS: Record<CheckName, readonly string[]> = {
  isInitialized: [],
  branchExists: ['name'],
  headPointsTo: ['ref'],
  headDetached: [],
  commitCount: [],
  fileInWorkingDirectory: ['path'],
  fileStaged: ['path'],
  fileTracked: ['path'],
  fileUntracked: ['path'],
  fileIgnored: ['path'],
  fileCommitted: ['path'],
  workingTreeClean: [],
  branchContains: ['branch', 'ref'],
  refsEqual: ['ref', 'other'],
  isMergeCommit: ['ref'],
  configEquals: ['key'],
  remoteExists: ['name'],
  remoteBranchMatches: ['remote', 'branch'],
  upstreamIs: ['branch', 'remote', 'remoteBranch'],
  lastCommitMessage: [],
  lastCommitAuthor: [],
}

/** Problems with a predicate written in a level file, as readable messages ([] when valid). */
export function validatePredicate(value: unknown, path = 'successPredicate'): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [`${path} must be an object`]
  }
  const p = value as Record<string, unknown>
  for (const combinator of ['all', 'any'] as const) {
    if (combinator in p) {
      if (!Array.isArray(p[combinator]) || (p[combinator] as unknown[]).length === 0) {
        return [`${path}.${combinator} must be a non-empty array`]
      }
      return (p[combinator] as unknown[]).flatMap((child, i) =>
        validatePredicate(child, `${path}.${combinator}[${i}]`),
      )
    }
  }
  if ('not' in p) return validatePredicate(p.not, `${path}.not`)
  if (typeof p.check !== 'string' || !(p.check in PREDICATE_CHECKS)) {
    return [`${path}.check must be one of: ${Object.keys(PREDICATE_CHECKS).join(', ')}`]
  }
  return PREDICATE_CHECKS[p.check as CheckName]
    .filter((field) => typeof p[field] !== 'string')
    .map((field) => `${path}.${field} must be a string for check "${p.check}"`)
}

function tipOf(world: World, branch: string | undefined) {
  return branch === undefined ? headCommitId(world.repo) : resolveRevision(world.repo, branch)
}

export function evaluatePredicate(world: World, predicate: Predicate): boolean {
  const repo = world.repo
  if ('all' in predicate) return predicate.all.every((p) => evaluatePredicate(world, p))
  if ('any' in predicate) return predicate.any.some((p) => evaluatePredicate(world, p))
  if ('not' in predicate) return !evaluatePredicate(world, predicate.not)

  switch (predicate.check) {
    case 'isInitialized':
      return repo.initialized
    case 'branchExists':
      return repo.branches.has(predicate.name)
    case 'headPointsTo':
      return currentBranch(repo) === predicate.ref
    case 'headDetached':
      return repo.HEAD.type === 'detached'
    case 'commitCount': {
      const tip = tipOf(world, predicate.onBranch)
      const count = tip === undefined ? 0 : ancestors(repo, tip).size
      if (predicate.equals !== undefined && count !== predicate.equals) return false
      if (predicate.min !== undefined && count < predicate.min) return false
      if (predicate.max !== undefined && count > predicate.max) return false
      return true
    }
    case 'fileInWorkingDirectory': {
      const content = repo.workingDirectory.get(normalizePath(predicate.path))
      return (
        content !== undefined && (predicate.content === undefined || content === predicate.content)
      )
    }
    case 'fileStaged': {
      const path = normalizePath(predicate.path)
      return repo.stagingArea.get(path) !== headTree(repo).get(path)
    }
    case 'fileTracked':
      return repo.stagingArea.has(normalizePath(predicate.path))
    case 'fileUntracked':
      return computeStatus(repo).untracked.includes(normalizePath(predicate.path))
    case 'fileIgnored':
      return isPathIgnored(repo.workingDirectory, normalizePath(predicate.path))
    case 'fileCommitted': {
      const tip = tipOf(world, predicate.onBranch)
      if (tip === undefined) return false
      const content = treeOf(repo, tip).get(normalizePath(predicate.path))
      return (
        content !== undefined && (predicate.content === undefined || content === predicate.content)
      )
    }
    case 'workingTreeClean':
      return repo.initialized && isWorkingTreeClean(repo)
    case 'branchContains': {
      const tip = resolveRevision(repo, predicate.branch)
      const target = resolveRevision(repo, predicate.ref)
      return tip !== undefined && target !== undefined && isAncestor(repo, target, tip)
    }
    case 'refsEqual': {
      const a = resolveRevision(repo, predicate.ref)
      return a !== undefined && a === resolveRevision(repo, predicate.other)
    }
    case 'isMergeCommit': {
      const id = resolveRevision(repo, predicate.ref)
      return id !== undefined && (repo.commits.get(id)?.parents.length ?? 0) > 1
    }
    case 'configEquals': {
      const key = predicate.key.toLowerCase()
      const scope = predicate.scope ?? 'any'
      const value =
        scope === 'local'
          ? repo.config.get(key)
          : scope === 'global'
            ? world.globalConfig.get(key)
            : getConfig(world, key)
      return value !== undefined && (predicate.value === undefined || value === predicate.value)
    }
    case 'remoteExists': {
      const remote = repo.remotes.get(predicate.name)
      return remote !== undefined && (predicate.url === undefined || remote.url === predicate.url)
    }
    case 'remoteBranchMatches': {
      const remote = repo.remotes.get(predicate.remote)
      const server = remote && world.servers.get(remote.url)
      const local = repo.branches.get(predicate.localBranch ?? predicate.branch)
      return (
        server !== undefined &&
        local !== undefined &&
        server.branches.get(predicate.branch) === local
      )
    }
    case 'upstreamIs': {
      const upstream = repo.upstreams.get(predicate.branch)
      return upstream?.remote === predicate.remote && upstream.branch === predicate.remoteBranch
    }
    case 'lastCommitMessage': {
      const tip = tipOf(world, predicate.onBranch)
      const message = tip === undefined ? undefined : repo.commits.get(tip)?.message
      if (message === undefined) return false
      if (predicate.equals !== undefined && message !== predicate.equals) return false
      if (predicate.contains !== undefined && !message.includes(predicate.contains)) return false
      return true
    }
    case 'lastCommitAuthor': {
      const tip = tipOf(world, predicate.onBranch)
      const author = tip === undefined ? undefined : repo.commits.get(tip)?.author
      if (author === undefined) return false
      if (predicate.name !== undefined && author.name !== predicate.name) return false
      if (predicate.email !== undefined && author.email !== predicate.email) return false
      return true
    }
    default: {
      const unknown: never = predicate
      throw new Error(`Unknown predicate check: ${JSON.stringify(unknown)}`)
    }
  }
}
