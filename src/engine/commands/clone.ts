import type { CommandDefinition } from '../command'
import { GitError } from '../errors'
import { createEmptyRepo, treeOf } from '../repo'
import { copyCommits, repositoryNotFoundError } from '../remotes'

/** "https://example.com/team/project.git" -> "project" */
export function repoNameFromUrl(url: string): string {
  const last = url.replace(/\/+$/, '').split(/[/:]/).at(-1) ?? 'repo'
  return last.replace(/\.git$/, '') || 'repo'
}

export const cloneCommand: CommandDefinition = {
  name: 'clone',
  summary: 'Copy a remote repository, with its full history, into this folder',
  flags: {},
  requiresRepo: false,
  run(world, args) {
    const [url, directory] = args.positionals
    if (url === undefined) {
      throw new GitError(
        'fatal: You must specify a repository to clone.',
        'Give the address of the repository to copy, like git clone https://example.com/project.git',
        'usage',
      )
    }
    const name = directory ?? repoNameFromUrl(url)
    if (world.repo.initialized || world.repo.workingDirectory.size > 0) {
      throw new GitError(
        `fatal: destination path '${name}' already exists and is not an empty directory.`,
        'In Git Quest you work with one repository at a time, so clone into an empty folder.',
      )
    }
    const server = world.servers.get(url)
    if (!server) {
      const notFound = repositoryNotFoundError(url)
      throw new GitError(`Cloning into '${name}'...\n${notFound.message}`, notFound.explanation)
    }

    const repo = createEmptyRepo()
    repo.initialized = true
    repo.remotes.set('origin', { name: 'origin', url })
    copyCommits(server, repo, [...server.branches.values()])
    for (const [branch, id] of server.branches) repo.remoteBranches.set(`origin/${branch}`, id)

    const defaultBranch = server.HEAD.type === 'branch' ? server.HEAD.ref : 'main'
    repo.HEAD = { type: 'branch', ref: defaultBranch }
    const tip = server.branches.get(defaultBranch)
    world.repo = repo
    if (tip === undefined) {
      return `Cloning into '${name}'...\nwarning: You appear to have cloned an empty repository.`
    }
    repo.branches.set(defaultBranch, tip)
    repo.upstreams.set(defaultBranch, { remote: 'origin', branch: defaultBranch })
    repo.stagingArea = new Map(treeOf(repo, tip))
    repo.workingDirectory = new Map(treeOf(repo, tip))
    return `Cloning into '${name}'...\ndone.`
  },
}
