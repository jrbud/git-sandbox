import type { CommandDefinition } from './command'
import { addCommand } from './commands/add'
import { branchCommand } from './commands/branch'
import { checkoutCommand } from './commands/checkout'
import { cloneCommand } from './commands/clone'
import { commitCommand } from './commands/commit'
import { configCommand } from './commands/config'
import { diffCommand } from './commands/diff'
import { fetchCommand } from './commands/fetch'
import { initCommand } from './commands/init'
import { logCommand } from './commands/log'
import { mergeCommand } from './commands/merge'
import { pullCommand } from './commands/pull'
import { pushCommand } from './commands/push'
import { remoteCommand } from './commands/remote'
import { statusCommand } from './commands/status'
import { switchCommand } from './commands/switch'

/**
 * Every git command the engine simulates. This is the single place a new command is added
 * (spec Section 4): write its CommandDefinition and list it here.
 */
export const COMMANDS: readonly CommandDefinition[] = [
  initCommand,
  addCommand,
  commitCommand,
  statusCommand,
  logCommand,
  diffCommand,
  branchCommand,
  checkoutCommand,
  switchCommand,
  mergeCommand,
  configCommand,
  remoteCommand,
  cloneCommand,
  fetchCommand,
  pullCommand,
  pushCommand,
]

export const commandRegistry: ReadonlyMap<string, CommandDefinition> = new Map(
  COMMANDS.map((command) => [command.name, command]),
)

/** Real git commands that Git Quest does not simulate (yet), so they get a friendlier error. */
export const UNSIMULATED_GIT_COMMANDS: ReadonlySet<string> = new Set([
  'am',
  'apply',
  'archive',
  'bisect',
  'blame',
  'bundle',
  'cherry-pick',
  'clean',
  'describe',
  'format-patch',
  'gc',
  'grep',
  'help',
  'maintenance',
  'mv',
  'notes',
  'prune',
  'rebase',
  'reflog',
  'reset',
  'restore',
  'revert',
  'rm',
  'shortlog',
  'show',
  'sparse-checkout',
  'stash',
  'submodule',
  'tag',
  'worktree',
])
