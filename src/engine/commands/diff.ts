import type { CommandDefinition } from '../command'
import { diffTrees, formatUnifiedDiff, type FileChange } from '../diff'
import { headTree } from '../repo'
import type { Repo } from '../types'
import { pathspecMatches } from './add'

/** Unstaged changes: working directory vs. staging area, for tracked files only. */
export function unstagedChanges(repo: Repo): FileChange[] {
  const tracked = new Map([...repo.workingDirectory].filter(([path]) => repo.stagingArea.has(path)))
  return diffTrees(repo.stagingArea, tracked)
}

/** Staged changes: staging area vs. the last commit. */
export function stagedChanges(repo: Repo): FileChange[] {
  return diffTrees(headTree(repo), repo.stagingArea)
}

export const diffCommand: CommandDefinition = {
  name: 'diff',
  summary: 'Show changes not yet staged, or staged changes with --staged',
  flags: { '--staged': { aliases: ['--cached'] } },
  requiresRepo: true,
  run(world, args) {
    const changes = args.has('--staged') ? stagedChanges(world.repo) : unstagedChanges(world.repo)
    const filtered =
      args.positionals.length === 0
        ? changes
        : changes.filter((c) => args.positionals.some((spec) => pathspecMatches(spec, c.path)))
    return formatUnifiedDiff(filtered)
  },
}
