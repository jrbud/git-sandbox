import type { CommandDefinition } from '../command'
import { GitError } from '../errors'
import { resolveRevision } from '../repo'
import { detachAt, remoteBranchGuess, switchToBranch, switchToNewBranch } from './checkout'

export const switchCommand: CommandDefinition = {
  name: 'switch',
  summary: 'Switch branches, or create one with -c',
  flags: {
    '-c': { takesValue: true, aliases: ['--create'] },
    '-d': { aliases: ['--detach'] },
  },
  requiresRepo: true,
  run(world, args) {
    const repo = world.repo
    const newBranch = args.value('-c')
    if (newBranch !== undefined) return switchToNewBranch(world, newBranch, args.positionals[0])

    const [target] = args.positionals
    if (target === undefined) {
      throw new GitError(
        'fatal: missing branch or commit argument',
        'Say which branch to switch to, like git switch main.',
        'usage',
      )
    }
    if (args.has('-d')) {
      const id = resolveRevision(repo, target)
      if (!id) {
        throw new GitError(
          `fatal: invalid reference: ${target}`,
          `There's no branch or commit called '${target}'.`,
        )
      }
      return detachAt(world, target, id)
    }
    if (repo.branches.has(target)) return switchToBranch(world, target)

    const guess = remoteBranchGuess(world, target)
    if (guess && !target.includes('/')) return switchToNewBranch(world, target, guess)

    if (resolveRevision(repo, target)) {
      throw new GitError(
        `fatal: a branch is expected, got ${repo.remoteBranches.has(target) ? 'remote branch' : 'commit'} '${target}'\nhint: If you want to detach HEAD at the commit, try again with the --detach option.`,
        'git switch moves between branches. To look at a single commit, add --detach.',
      )
    }
    throw new GitError(
      `fatal: invalid reference: ${target}`,
      `There's no branch called '${target}'. Use git branch to see the branches, or git switch -c ${target} to create it.`,
    )
  },
}
