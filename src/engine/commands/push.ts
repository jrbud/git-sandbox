import type { CommandDefinition } from '../command'
import { GitError } from '../errors'
import { isAncestor } from '../graph'
import { currentBranch } from '../repo'
import { copyCommits, defaultRemoteName, refUpdateLine, requireRemote } from '../remotes'
import { noRemoteSpecifiedError } from './fetch'

function noUpstreamError(branch: string, remote: string): GitError {
  return new GitError(
    [
      `fatal: The current branch ${branch} has no upstream branch.`,
      'To push the current branch and set the remote as upstream, use',
      '',
      `    git push --set-upstream ${remote} ${branch}`,
    ].join('\n'),
    `'${branch}' isn't linked to a branch on the remote yet. The first time, push with: git push -u ${remote} ${branch}`,
  )
}

function rejectedError(url: string, source: string, target: string, fetchFirst: boolean): GitError {
  return new GitError(
    [
      `To ${url}`,
      ` ! [rejected]        ${source} -> ${target} (${fetchFirst ? 'fetch first' : 'non-fast-forward'})`,
      `error: failed to push some refs to '${url}'`,
      ...(fetchFirst
        ? [
            'hint: Updates were rejected because the remote contains work that you do not',
            'hint: have locally. This is usually caused by another repository pushing to',
            'hint: the same ref. If you want to integrate the remote changes, use',
            "hint: 'git pull' before pushing again.",
          ]
        : [
            'hint: Updates were rejected because the tip of your current branch is behind',
            'hint: its remote counterpart. If you want to integrate the remote changes,',
            "hint: use 'git pull' before pushing again.",
          ]),
    ].join('\n'),
    'The remote branch has commits that yours does not, so pushing would throw them away. Run git pull to bring them in, then push again.',
  )
}

export const pushCommand: CommandDefinition = {
  name: 'push',
  summary: 'Upload your commits to a remote branch',
  flags: { '-u': { aliases: ['--set-upstream'] } },
  requiresRepo: true,
  run(world, args) {
    const repo = world.repo
    const [remoteArg, sourceArg] = args.positionals

    if (repo.remotes.size === 0 && remoteArg === undefined) {
      throw new GitError(
        'fatal: No configured push destination.\nEither specify the URL from the command-line or configure a remote repository using\n\n    git remote add <name> <url>\n\nand then push using the remote name\n\n    git push <name>',
        "There's nowhere to push to yet. Add a remote first with git remote add origin <url>.",
      )
    }

    // Which local branch is being pushed.
    let source = sourceArg
    if (source === undefined || source === 'HEAD') {
      const branch = currentBranch(repo)
      if (!branch) {
        throw new GitError(
          'fatal: You are not currently on a branch.\nTo push the history leading to the current (detached HEAD)\nstate now, use\n\n    git push origin HEAD:<name-of-remote-branch>',
          "HEAD is detached, so there's no branch to push. Switch to a branch first.",
        )
      }
      source = branch
    }
    const upstream = repo.upstreams.get(source)

    // Which remote it goes to. A bare `git push` needs an upstream (push.default=simple).
    let remoteName = remoteArg
    if (sourceArg === undefined) {
      const remote = remoteArg ?? upstream?.remote ?? defaultRemoteName(repo)
      if (remote === undefined) throw noRemoteSpecifiedError()
      const hasUpstream = upstream !== undefined && upstream.remote === remote
      if (!hasUpstream && !(args.has('-u') && remoteArg !== undefined))
        throw noUpstreamError(source, remote)
      remoteName = remote
    }
    const target = upstream && upstream.remote === remoteName ? upstream.branch : source

    const { remote, server } = requireRemote(world, remoteName!)
    const local = repo.branches.get(source)
    if (local === undefined) {
      throw new GitError(
        `error: src refspec ${source} does not match any\nerror: failed to push some refs to '${remote.url}'`,
        `There's no local branch called '${source}' with commits to push. Make a commit first, or check the name with git branch.`,
      )
    }

    const old = server.branches.get(target)
    const lines: string[] = []
    if (old === local) {
      lines.push('Everything up-to-date')
    } else {
      if (old !== undefined && !isAncestor(repo, old, local)) {
        throw rejectedError(remote.url, source, target, !repo.commits.has(old))
      }
      copyCommits(repo, server, [local])
      server.branches.set(target, local)
      // The first branch pushed to an empty remote becomes its default branch.
      const serverHead = server.HEAD.type === 'branch' ? server.HEAD.ref : undefined
      if (
        server.branches.size === 1 &&
        (serverHead === undefined || !server.branches.has(serverHead))
      ) {
        server.HEAD = { type: 'branch', ref: target }
      }
      lines.push(
        `To ${remote.url}`,
        refUpdateLine(old, local, source, target).replace(/ +-> /, ' -> '),
      )
    }

    repo.remoteBranches.set(`${remoteName}/${target}`, local)
    if (args.has('-u')) {
      repo.upstreams.set(source, { remote: remoteName!, branch: target })
      lines.push(`branch '${source}' set up to track '${remoteName}/${target}'.`)
    }
    return lines.join('\n')
  },
}
