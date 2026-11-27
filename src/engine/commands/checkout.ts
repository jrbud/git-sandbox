import type { CommandDefinition } from '../command'
import { GitError } from '../errors'
import { normalizePath } from '../files'
import { shortId } from '../hash'
import {
  currentBranch,
  firstLine,
  getCommit,
  headCommitId,
  headTree,
  isValidBranchName,
  resolveRevision,
  treeOf,
} from '../repo'
import { trackingSummary } from '../status'
import type { CommitId, World } from '../types'
import { moveWorktree } from '../worktree'
import { branchExistsError, createBranch, invalidBranchNameError } from './branch'

function withTracking(world: World, branch: string, line: string): string {
  const tracking = trackingSummary(world.repo, branch)
  return tracking ? `${line}\n${tracking}` : line
}

/** Leaving a detached HEAD prints where it was, as real git does. */
function previousHeadNote(world: World, target: CommitId | undefined): string {
  const repo = world.repo
  const head = headCommitId(repo)
  if (repo.HEAD.type !== 'detached' || !head || head === target) return ''
  return `Previous HEAD position was ${shortId(head)} ${firstLine(getCommit(repo, head).message)}\n`
}

/** Check out an existing local branch. */
export function switchToBranch(world: World, branch: string): string {
  const repo = world.repo
  if (currentBranch(repo) === branch) return withTracking(world, branch, `Already on '${branch}'`)
  const target = repo.branches.get(branch)!
  const note = previousHeadNote(world, target)
  moveWorktree(repo, headTree(repo), treeOf(repo, target), 'checkout')
  repo.HEAD = { type: 'branch', ref: branch }
  return withTracking(world, branch, `${note}Switched to branch '${branch}'`)
}

/** Create a branch at `startPoint` (default HEAD) and check it out. */
export function switchToNewBranch(
  world: World,
  branch: string,
  startPoint: string | undefined,
): string {
  const repo = world.repo
  if (!headCommitId(repo) && startPoint === undefined) {
    // No commits yet: the new branch is simply where the first commit will go.
    if (!isValidBranchName(branch)) throw invalidBranchNameError(branch)
    if (repo.branches.has(branch)) throw branchExistsError(branch)
    repo.HEAD = { type: 'branch', ref: branch }
    return `Switched to a new branch '${branch}'`
  }
  const note = previousHeadNote(world, undefined)
  const before = headTree(repo)
  const { id, tracking } = createBranch(repo, branch, startPoint)
  try {
    moveWorktree(repo, before, treeOf(repo, id), 'checkout')
  } catch (error) {
    repo.branches.delete(branch)
    throw error
  }
  repo.HEAD = { type: 'branch', ref: branch }
  const switched = `${note}Switched to a new branch '${branch}'`
  return tracking ? `${tracking}\n${withTracking(world, branch, switched)}` : switched
}

/** Check out a commit directly, leaving HEAD detached. */
export function detachAt(world: World, revision: string, id: CommitId): string {
  const repo = world.repo
  const note = previousHeadNote(world, id)
  moveWorktree(repo, headTree(repo), treeOf(repo, id), 'checkout')
  const wasDetached = repo.HEAD.type === 'detached'
  repo.HEAD = { type: 'detached', ref: id }
  const headLine = `HEAD is now at ${shortId(id)} ${firstLine(getCommit(repo, id).message)}`
  if (wasDetached) return `${note}${headLine}`
  return [
    `Note: switching to '${revision}'.`,
    '',
    "You are in 'detached HEAD' state. You can look around, make experimental",
    'changes and commit them, and you can discard any commits you make in this',
    'state without impacting any branches by switching back to a branch.',
    '',
    'If you want to create a new branch to retain commits you create, you may',
    'do so (now or later) by using -c with the switch command. Example:',
    '',
    '  git switch -c <new-branch-name>',
    '',
    headLine,
  ].join('\n')
}

/** `git checkout feature` with no local `feature` but an `origin/feature`: create a tracking branch. */
export function remoteBranchGuess(world: World, name: string): string | undefined {
  const matches = [...world.repo.remoteBranches.keys()].filter(
    (ref) => ref.slice(ref.indexOf('/') + 1) === name,
  )
  return matches.length === 1 ? matches[0] : undefined
}

export const checkoutCommand: CommandDefinition = {
  name: 'checkout',
  summary: 'Switch branches, or create one with -b',
  flags: {
    '-b': { takesValue: true },
    '--detach': {},
  },
  requiresRepo: true,
  run(world, args) {
    const repo = world.repo
    const newBranch = args.value('-b')
    if (newBranch !== undefined) return switchToNewBranch(world, newBranch, args.positionals[0])

    const [target] = args.positionals
    if (target === undefined) return ''
    if (!args.has('--detach')) {
      if (repo.branches.has(target)) return switchToBranch(world, target)
      const guess = remoteBranchGuess(world, target)
      if (guess) return switchToNewBranch(world, target, guess)
    }
    const id = resolveRevision(repo, target)
    if (id) return detachAt(world, target, id)

    const path = normalizePath(target)
    if (repo.workingDirectory.has(path) || repo.stagingArea.has(path)) {
      throw new GitError(
        `error: 'git checkout ${target}' to restore a file is not supported in Git Quest`,
        "git checkout can also throw away changes to a file, but that's not part of Git Quest yet. To switch branches, give a branch name.",
        'usage',
      )
    }
    throw new GitError(
      `error: pathspec '${target}' did not match any file(s) known to git`,
      `There's no branch called '${target}'. Use git branch to see the branches, or git checkout -b ${target} to create it.`,
    )
  },
}
