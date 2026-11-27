import type { CommandDefinition } from '../command'
import { GitError } from '../errors'
import { commitsInLogOrder } from '../graph'
import { shortId } from '../hash'
import { currentBranch, firstLine, formatGitDate, headCommitId, resolveRevision } from '../repo'
import type { CommitId, Repo } from '../types'

/** "HEAD -> main, origin/main, feature" for the refs that point at a commit. */
export function decorations(repo: Repo, id: CommitId): string {
  const parts: string[] = []
  const branch = currentBranch(repo)
  const head = headCommitId(repo)
  const headHere = head === id
  if (headHere) parts.push(branch ? `HEAD -> ${branch}` : 'HEAD')
  const pointingHere = (refs: Map<string, CommitId>) =>
    [...refs].filter(([, at]) => at === id).map(([name]) => name)
  parts.push(...pointingHere(repo.remoteBranches).sort())
  parts.push(
    ...pointingHere(repo.branches)
      .filter((name) => !(headHere && name === branch))
      .sort(),
  )
  return parts.join(', ')
}

export const logCommand: CommandDefinition = {
  name: 'log',
  summary: 'Show the commit history',
  flags: {
    '--oneline': {},
    '-n': { takesValue: true, aliases: ['--max-count'], numericShorthand: true },
    '--all': {},
  },
  requiresRepo: true,
  run(world, args) {
    const repo = world.repo
    const starts: CommitId[] = []
    if (args.has('--all')) {
      const head = headCommitId(repo)
      if (head) starts.push(head)
      starts.push(...repo.branches.values(), ...repo.remoteBranches.values())
    }
    for (const revision of args.positionals) {
      const id = resolveRevision(repo, revision)
      if (!id) {
        throw new GitError(
          `fatal: ambiguous argument '${revision}': unknown revision or path not in the working tree.`,
          `There's no branch or commit called '${revision}'. Use git branch to see the branch names.`,
        )
      }
      starts.push(id)
    }
    if (starts.length === 0) {
      const head = headCommitId(repo)
      if (!head) {
        const branch = currentBranch(repo) ?? 'HEAD'
        throw new GitError(
          `fatal: your current branch '${branch}' does not have any commits yet`,
          "There's no history to show yet. Make a commit first.",
        )
      }
      starts.push(head)
    }

    let commits = commitsInLogOrder(repo, starts)
    const limit = args.value('-n')
    if (limit !== undefined) {
      const n = Number(limit)
      if (!Number.isInteger(n) || n < 0) {
        throw new GitError(
          `fatal: '${limit}': not an integer`,
          'The -n option needs a whole number, like git log -n 3.',
          'usage',
        )
      }
      commits = commits.slice(0, n)
    }

    if (args.has('--oneline')) {
      return commits
        .map((c) => {
          const refs = decorations(repo, c.id)
          return `${shortId(c.id)} ${refs ? `(${refs}) ` : ''}${firstLine(c.message)}`
        })
        .join('\n')
    }
    return commits
      .map((c) => {
        const refs = decorations(repo, c.id)
        const lines = [`commit ${c.id}${refs ? ` (${refs})` : ''}`]
        if (c.parents.length > 1) lines.push(`Merge: ${c.parents.map(shortId).join(' ')}`)
        lines.push(
          `Author: ${c.author.name} <${c.author.email}>`,
          `Date:   ${formatGitDate(c.timestamp)}`,
          '',
          ...c.message.split('\n').map((line) => `    ${line}`),
        )
        return lines.join('\n')
      })
      .join('\n\n')
  },
}
