import type { CommandDefinition } from '../command'
import { diffTrees, formatDiffstat, merge3 } from '../diff'
import { GitError } from '../errors'
import { isAncestor, mergeBase } from '../graph'
import { shortId } from '../hash'
import {
  createCommit,
  currentBranch,
  headCommitId,
  headTree,
  moveHead,
  requireAuthor,
  resolveRevision,
  treeOf,
} from '../repo'
import type { CommitId, FileMap, World } from '../types'
import { localChangesError, moveWorktree } from '../worktree'

export interface MergeOptions {
  /** Default merge commit message, before " into <branch>" is added. */
  label: string
  message?: string
  noFastForward?: boolean
  fastForwardOnly?: boolean
}

type FileMerge = { ok: true; content: string | undefined } | { ok: false; reason: string }

function mergeFile(path: string, base?: string, ours?: string, theirs?: string): FileMerge {
  if (ours === theirs) return { ok: true, content: ours }
  if (base === ours) return { ok: true, content: theirs }
  if (base === theirs) return { ok: true, content: ours }
  if (ours === undefined || theirs === undefined) {
    const deletedIn = ours === undefined ? 'HEAD' : 'theirs'
    const modifiedIn = ours === undefined ? 'theirs' : 'HEAD'
    return {
      ok: false,
      reason: `CONFLICT (modify/delete): ${path} deleted in ${deletedIn} and modified in ${modifiedIn}.`,
    }
  }
  if (base === undefined)
    return { ok: false, reason: `CONFLICT (add/add): Merge conflict in ${path}` }
  const merged = merge3(base, ours, theirs)
  return merged.ok
    ? { ok: true, content: merged.content }
    : { ok: false, reason: `CONFLICT (content): Merge conflict in ${path}` }
}

/** A real three-way merge of whole snapshots. Conflicts are reported, not resolved. */
export function mergeTrees(
  base: FileMap,
  ours: FileMap,
  theirs: FileMap,
): { tree: FileMap; conflicts: string[] } {
  const tree: FileMap = new Map()
  const conflicts: string[] = []
  const paths = [...new Set([...base.keys(), ...ours.keys(), ...theirs.keys()])].sort()
  for (const path of paths) {
    const result = mergeFile(path, base.get(path), ours.get(path), theirs.get(path))
    if (!result.ok) conflicts.push(result.reason)
    else if (result.content !== undefined) tree.set(path, result.content)
  }
  return { tree, conflicts }
}

function defaultMessage(world: World, label: string): string {
  const branch = currentBranch(world.repo)
  return branch && branch !== 'main' && branch !== 'master' ? `${label} into ${branch}` : label
}

/**
 * Merge commit `theirs` into HEAD: fast-forward when possible, otherwise a three-way merge
 * that creates a merge commit with two parents. Shared by `git merge` and `git pull`.
 */
export function mergeInto(world: World, theirs: CommitId, options: MergeOptions): string {
  const repo = world.repo
  const ours = headCommitId(repo)

  if (!ours) {
    // Nothing committed yet: adopt their history outright.
    moveWorktree(repo, new Map(), treeOf(repo, theirs), 'merge')
    moveHead(repo, theirs)
    return `Fast-forward`
  }
  if (isAncestor(repo, theirs, ours)) return 'Already up to date.'

  const canFastForward = isAncestor(repo, ours, theirs)
  if (canFastForward && !options.noFastForward) {
    const before = headTree(repo)
    moveWorktree(repo, before, treeOf(repo, theirs), 'merge')
    moveHead(repo, theirs)
    const stat = formatDiffstat(diffTrees(before, treeOf(repo, theirs)))
    return [`Updating ${shortId(ours)}..${shortId(theirs)}`, 'Fast-forward', stat]
      .filter(Boolean)
      .join('\n')
  }
  if (options.fastForwardOnly) {
    throw new GitError(
      'fatal: Not possible to fast-forward, aborting.',
      'Both branches have new commits, so git would need a merge commit, and --ff-only forbids that.',
    )
  }

  const base = mergeBase(repo, ours, theirs)
  const ourTree = headTree(repo)
  const { tree, conflicts } = mergeTrees(treeOf(repo, base), ourTree, treeOf(repo, theirs))
  if (conflicts.length > 0) {
    throw new GitError(
      [...conflicts, 'Automatic merge failed; fix conflicts and then commit the result.'].join(
        '\n',
      ),
      'Both branches changed the same part of the same file, which is a merge conflict. Resolving conflicts is covered in the Collaboration section, so Git Quest stopped the merge and left everything as it was.',
    )
  }

  // The merge commit is built from the merged tree, so staged-but-uncommitted work would be
  // lost; real git refuses in that case. moveWorktree guards unstaged and untracked files.
  const staged = diffTrees(ourTree, repo.stagingArea).map((c) => c.path)
  if (staged.length > 0) throw localChangesError('merge', staged)
  const author = requireAuthor(world)
  moveWorktree(repo, ourTree, tree, 'merge')
  const commit = createCommit(world, {
    parents: [ours, theirs],
    message: options.message ?? defaultMessage(world, options.label),
    tree,
    author,
  })
  moveHead(repo, commit.id)
  const stat = formatDiffstat(diffTrees(ourTree, tree))
  return ["Merge made by the 'ort' strategy.", stat].filter(Boolean).join('\n')
}

export const mergeCommand: CommandDefinition = {
  name: 'merge',
  summary: 'Join another branch into the current branch',
  flags: {
    '--no-ff': {},
    '--ff-only': {},
    '-m': { takesValue: true, aliases: ['--message'] },
  },
  requiresRepo: true,
  run(world, args) {
    const repo = world.repo
    const [target, ...extra] = args.positionals
    if (target === undefined) {
      throw new GitError(
        'fatal: No remote for the current branch.',
        'Say which branch to merge into the current one, like git merge feature.',
        'usage',
      )
    }
    if (extra.length > 0) {
      throw new GitError(
        'fatal: merging more than one branch at once is not supported in Git Quest',
        'Merge one branch at a time.',
        'usage',
      )
    }
    const theirs = resolveRevision(repo, target)
    if (!theirs) {
      throw new GitError(
        `merge: ${target} - not something we can merge`,
        `There's no branch or commit called '${target}'. Check the name with git branch.`,
      )
    }
    const label = repo.branches.has(target)
      ? `Merge branch '${target}'`
      : repo.remoteBranches.has(target)
        ? `Merge remote-tracking branch '${target}'`
        : `Merge commit '${target}'`
    return mergeInto(world, theirs, {
      label,
      message: args.value('-m'),
      noFastForward: args.has('--no-ff'),
      fastForwardOnly: args.has('--ff-only'),
    })
  },
}
