import type { CommandDefinition } from '../command'
import type { ChangeKind } from '../diff'
import { shortId } from '../hash'
import { currentBranch, headCommitId } from '../repo'
import { computeStatus, trackingSummary, type StatusEntry } from '../status'

const LABELS: Record<ChangeKind, string> = {
  added: 'new file:   ',
  modified: 'modified:   ',
  deleted: 'deleted:    ',
}

const SHORT: Record<ChangeKind, string> = { added: 'A', modified: 'M', deleted: 'D' }

function entries(list: StatusEntry[]): string[] {
  return list.map((entry) => `\t${LABELS[entry.kind]}${entry.path}`)
}

export const statusCommand: CommandDefinition = {
  name: 'status',
  summary: 'Show staged, unstaged and untracked changes',
  flags: { '-s': { aliases: ['--short'] } },
  requiresRepo: true,
  run(world, args) {
    const repo = world.repo
    const status = computeStatus(repo)

    if (args.has('-s')) {
      const codes = new Map<string, [string, string]>()
      for (const e of status.staged) codes.set(e.path, [SHORT[e.kind], ' '])
      for (const e of status.unstaged)
        codes.set(e.path, [codes.get(e.path)?.[0] ?? ' ', SHORT[e.kind]])
      const lines = [...codes.keys()].sort().map((path) => `${codes.get(path)!.join('')} ${path}`)
      return [...lines, ...status.untracked.map((path) => `?? ${path}`)].join('\n')
    }

    const head = headCommitId(repo)
    const branch = currentBranch(repo)
    const out: string[] = [branch ? `On branch ${branch}` : `HEAD detached at ${shortId(head!)}`]
    if (branch) {
      const tracking = trackingSummary(repo, branch)
      if (tracking) out.push(tracking)
    }
    if (!head) out.push('', 'No commits yet')

    if (status.staged.length > 0) {
      out.push(
        '',
        'Changes to be committed:',
        head
          ? '  (use "git restore --staged <file>..." to unstage)'
          : '  (use "git rm --cached <file>..." to unstage)',
        ...entries(status.staged),
      )
    }
    if (status.unstaged.length > 0) {
      out.push(
        '',
        'Changes not staged for commit:',
        '  (use "git add <file>..." to update what will be committed)',
        '  (use "git restore <file>..." to discard changes in working directory)',
        ...entries(status.unstaged),
      )
    }
    if (status.untracked.length > 0) {
      out.push(
        '',
        'Untracked files:',
        '  (use "git add <file>..." to include in what will be committed)',
        ...status.untracked.map((path) => `\t${path}`),
      )
    }

    // Real git separates the closing line with a blank line only when something came before it.
    if (status.staged.length === 0 && out.length > 1) out.push('')
    if (status.staged.length > 0) {
      // Nothing more to say: the staged list is the summary.
    } else if (status.unstaged.length > 0) {
      out.push('no changes added to commit (use "git add" and/or "git commit -a")')
    } else if (status.untracked.length > 0) {
      out.push('nothing added to commit but untracked files present (use "git add" to track)')
    } else if (!head) {
      out.push('nothing to commit (create/copy files and use "git add" to track)')
    } else {
      out.push('nothing to commit, working tree clean')
    }
    return out.join('\n')
  },
}
