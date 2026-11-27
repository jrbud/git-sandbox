import type { CommandDefinition } from '../command'
import { diffTrees, formatSummaryLine } from '../diff'
import { GitError } from '../errors'
import { shortId } from '../hash'
import {
  createCommit,
  currentBranch,
  firstLine,
  headCommitId,
  headTree,
  moveHead,
  requireAuthor,
} from '../repo'
import { computeStatus } from '../status'
import type { Repo } from '../types'

function nothingToCommitError(repo: Repo): GitError {
  const status = computeStatus(repo)
  const branch = currentBranch(repo)
  const where = branch ? `On branch ${branch}` : 'Not currently on any branch.'
  const summary =
    status.unstaged.length > 0
      ? 'no changes added to commit (use "git add" and/or "git commit -a")'
      : status.untracked.length > 0
        ? 'nothing added to commit but untracked files present (use "git add" to track)'
        : 'nothing to commit, working tree clean'
  return new GitError(
    `${where}\n${summary}`,
    'A commit saves what is in the staging area, and nothing new is staged. Use git add to stage your changes first.',
  )
}

export const commitCommand: CommandDefinition = {
  name: 'commit',
  summary: 'Record the staged snapshot as a new commit',
  flags: {
    '-m': { takesValue: true, aliases: ['--message'] },
    '-a': { aliases: ['--all'] },
    '--allow-empty': {},
  },
  requiresRepo: true,
  run(world, args) {
    const repo = world.repo
    if (args.has('-a')) {
      for (const path of [...repo.stagingArea.keys()]) {
        const content = repo.workingDirectory.get(path)
        if (content === undefined) repo.stagingArea.delete(path)
        else repo.stagingArea.set(path, content)
      }
    }

    const message = args
      .values('-m')
      .filter((part) => part.trim() !== '')
      .join('\n\n')
    if (message === '') {
      throw new GitError(
        'Aborting commit due to empty commit message.',
        'Every commit needs a message. Git Quest has no text editor, so add one with -m, like: git commit -m "Describe your change"',
        'usage',
      )
    }

    const parent = headCommitId(repo)
    const changes = diffTrees(headTree(repo), repo.stagingArea)
    if (changes.length === 0 && !args.has('--allow-empty')) throw nothingToCommitError(repo)

    const author = requireAuthor(world)
    const commit = createCommit(world, {
      parents: parent ? [parent] : [],
      message,
      tree: repo.stagingArea,
      author,
    })
    moveHead(repo, commit.id)

    const branch = currentBranch(repo)
    const label = branch ? `${branch}${parent ? '' : ' (root-commit)'}` : 'detached HEAD'
    const lines = [
      `[${label} ${shortId(commit.id)}] ${firstLine(message)}`,
      formatSummaryLine(changes),
    ]
    for (const change of changes) {
      if (change.kind === 'added') lines.push(` create mode 100644 ${change.path}`)
      if (change.kind === 'deleted') lines.push(` delete mode 100644 ${change.path}`)
    }
    return lines.join('\n')
  },
}
