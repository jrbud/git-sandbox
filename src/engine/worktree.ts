import { GitError } from './errors'
import { isIgnored, loadIgnoreRules } from './ignore'
import type { FileMap, Repo } from './types'

export type TreeOperation = 'checkout' | 'merge'

const ADVICE: Record<TreeOperation, { local: string; untracked: string }> = {
  checkout: {
    local: 'Please commit your changes or stash them before you switch branches.',
    untracked: 'Please move or remove them before you switch branches.',
  },
  merge: {
    local: 'Please commit your changes or stash them before you merge.',
    untracked: 'Please move or remove them before you merge.',
  },
}

export function localChangesError(operation: TreeOperation, paths: string[]): GitError {
  return new GitError(
    [
      `error: Your local changes to the following files would be overwritten by ${operation}:`,
      ...paths.map((p) => `\t${p}`),
      ADVICE[operation].local,
      'Aborting',
    ].join('\n'),
    operation === 'checkout'
      ? "You have changes that haven't been committed, and switching would overwrite them. Commit them first."
      : "You have changes that haven't been committed, and the merge would overwrite them. Commit them first.",
  )
}

export function untrackedOverwriteError(operation: TreeOperation, paths: string[]): GitError {
  return new GitError(
    [
      `error: The following untracked working tree files would be overwritten by ${operation}:`,
      ...paths.map((p) => `\t${p}`),
      ADVICE[operation].untracked,
      'Aborting',
    ].join('\n'),
    "A file git isn't tracking is in the way of a file with the same name it needs to write. Add and commit it, or remove it.",
  )
}

/**
 * Move the staging area and working directory from snapshot `from` to snapshot `to`,
 * the way `git checkout` and fast-forward merges do: files that differ between the two
 * snapshots are replaced, and uncommitted changes to other files are carried along.
 * Refuses (throws) if that would destroy uncommitted work.
 */
export function moveWorktree(
  repo: Repo,
  from: FileMap,
  to: FileMap,
  operation: TreeOperation,
): void {
  const rules = loadIgnoreRules(repo.workingDirectory)
  const index = repo.stagingArea
  const work = repo.workingDirectory
  const changing = [...new Set([...from.keys(), ...to.keys()])]
    .filter((path) => from.get(path) !== to.get(path))
    .sort()

  const dirty: string[] = []
  const blocking: string[] = []
  for (const path of changing) {
    const tracked = from.has(path) || index.has(path)
    const alreadyMatches = index.get(path) === to.get(path) && work.get(path) === to.get(path)
    if (tracked) {
      const isDirty = index.get(path) !== from.get(path) || work.get(path) !== index.get(path)
      if (isDirty && !alreadyMatches) dirty.push(path)
    } else if (work.has(path) && to.has(path) && work.get(path) !== to.get(path)) {
      if (!isIgnored(path, rules)) blocking.push(path)
    }
  }
  if (dirty.length > 0) throw localChangesError(operation, dirty)
  if (blocking.length > 0) throw untrackedOverwriteError(operation, blocking)

  for (const path of changing) {
    const content = to.get(path)
    if (content === undefined) {
      index.delete(path)
      work.delete(path)
    } else {
      index.set(path, content)
      work.set(path, content)
    }
  }
}
