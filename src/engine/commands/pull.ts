import type { CommandDefinition } from '../command'
import { GitError } from '../errors'
import { currentBranch } from '../repo'
import { fetchRemote, noRemoteSpecifiedError } from './fetch'
import { mergeInto } from './merge'

export const pullCommand: CommandDefinition = {
  name: 'pull',
  summary: 'Fetch from a remote and merge its changes into the current branch',
  flags: { '--ff-only': {}, '--no-ff': {}, '--no-rebase': {} },
  requiresRepo: true,
  run(world, args) {
    const repo = world.repo
    const branch = currentBranch(repo)
    let [remoteName, remoteBranch] = args.positionals

    if (remoteName === undefined) {
      if (repo.remotes.size === 0) throw noRemoteSpecifiedError()
      if (!branch) {
        throw new GitError(
          'You are not currently on a branch.\nPlease specify which branch you want to merge with.\nSee git-pull(1) for details.\n\n    git pull <remote> <branch>',
          "HEAD is detached, so git doesn't know which branch to update. Switch to a branch first.",
        )
      }
      const upstream = repo.upstreams.get(branch)
      if (!upstream) {
        throw new GitError(
          [
            'There is no tracking information for the current branch.',
            'Please specify which branch you want to merge with.',
            'See git-pull(1) for details.',
            '',
            '    git pull <remote> <branch>',
            '',
            'If you wish to set tracking information for this branch you can do so with:',
            '',
            `    git branch --set-upstream-to=origin/${branch} ${branch}`,
          ].join('\n'),
          `'${branch}' isn't linked to a remote branch yet. Say where to pull from, like git pull origin ${branch}, or push with -u first.`,
        )
      }
      remoteName = upstream.remote
      remoteBranch = upstream.branch
    }
    if (remoteBranch === undefined) {
      const upstream = branch ? repo.upstreams.get(branch) : undefined
      if (upstream?.remote !== remoteName) {
        throw new GitError(
          `fatal: Git Quest needs a branch name: git pull ${remoteName} <branch>`,
          `Say which branch on '${remoteName}' to pull, like git pull ${remoteName} main.`,
          'usage',
        )
      }
      remoteBranch = upstream.branch
    }

    const fetched = fetchRemote(world, remoteName)
    const url = repo.remotes.get(remoteName)!.url
    const theirs = repo.remoteBranches.get(`${remoteName}/${remoteBranch}`)
    if (theirs === undefined) {
      throw new GitError(
        `fatal: couldn't find remote ref ${remoteBranch}`,
        `The remote '${remoteName}' has no branch called '${remoteBranch}'.`,
      )
    }
    const merged = mergeInto(world, theirs, {
      label: `Merge branch '${remoteBranch}' of ${url}`,
      noFastForward: args.has('--no-ff'),
      fastForwardOnly: args.has('--ff-only'),
    })
    return [fetched, merged].filter(Boolean).join('\n')
  },
}
