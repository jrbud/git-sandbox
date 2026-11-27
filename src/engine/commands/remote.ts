import type { CommandDefinition } from '../command'
import { GitError } from '../errors'

export const remoteCommand: CommandDefinition = {
  name: 'remote',
  summary: 'List, add or remove remote repositories',
  flags: { '-v': { aliases: ['--verbose'] } },
  subcommands: ['add', 'remove', 'rm'],
  requiresRepo: true,
  run(world, args) {
    const repo = world.repo
    const [sub, name, url, ...extra] = args.positionals

    if (sub === undefined) {
      const names = [...repo.remotes.keys()].sort()
      if (!args.has('-v')) return names.join('\n')
      return names
        .flatMap((n) => {
          const u = repo.remotes.get(n)!.url
          return [`${n}\t${u} (fetch)`, `${n}\t${u} (push)`]
        })
        .join('\n')
    }

    if (sub === 'add') {
      if (name === undefined || url === undefined || extra.length > 0) {
        throw new GitError(
          'usage: git remote add <name> <url>',
          'Give the remote a short name and its address, like git remote add origin https://example.com/project.git',
          'usage',
        )
      }
      if (repo.remotes.has(name)) {
        throw new GitError(
          `error: remote ${name} already exists.`,
          `You already have a remote called '${name}'. See it with git remote -v.`,
        )
      }
      repo.remotes.set(name, { name, url })
      return ''
    }

    if (sub === 'remove' || sub === 'rm') {
      if (name === undefined) {
        throw new GitError(
          'usage: git remote remove <name>',
          'Say which remote to remove.',
          'usage',
        )
      }
      if (!repo.remotes.has(name)) {
        throw new GitError(
          `error: No such remote: '${name}'`,
          `There's no remote called '${name}'.`,
        )
      }
      repo.remotes.delete(name)
      for (const ref of [...repo.remoteBranches.keys()]) {
        if (ref.startsWith(`${name}/`)) repo.remoteBranches.delete(ref)
      }
      for (const [branch, upstream] of [...repo.upstreams]) {
        if (upstream.remote === name) repo.upstreams.delete(branch)
      }
      return ''
    }

    throw new GitError(
      `error: unknown subcommand: \`${sub}'`,
      'Git Quest supports git remote, git remote -v, git remote add and git remote remove.',
      'usage',
    )
  },
}
