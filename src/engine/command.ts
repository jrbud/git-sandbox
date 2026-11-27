import { Args, parseArgs, type FlagSpec } from './args'
import { notARepositoryError } from './errors'
import { cloneWorld } from './repo'
import type { World } from './types'

export interface CommandDefinition {
  /** The git verb, e.g. "commit". */
  name: string
  /** One-line description for help text and cheatsheets. */
  summary: string
  flags: FlagSpec
  /** Words that may follow the verb as a subcommand, e.g. `remote add`. */
  subcommands?: string[]
  /** Whether the command fails with "not a git repository" before `git init`. */
  requiresRepo: boolean | ((args: Args) => boolean)
  /**
   * Run the command against `world`, which is a private copy the command may change freely.
   * Returns terminal output; throws GitError on failure.
   */
  run(world: World, args: Args): string
}

export interface CommandResult {
  world: World
  output: string
}

/**
 * Run one command definition with already-tokenized arguments. The input world is never
 * modified: the command works on a deep copy, which is returned on success.
 */
export function executeCommand(
  world: World,
  definition: CommandDefinition,
  tokens: string[],
): CommandResult {
  const args = parseArgs(definition.name, tokens, definition.flags)
  const needsRepo =
    typeof definition.requiresRepo === 'function'
      ? definition.requiresRepo(args)
      : definition.requiresRepo
  if (needsRepo && !world.repo.initialized) throw notARepositoryError()

  const draft = cloneWorld(world)
  const output = definition.run(draft, args)
  return { world: draft, output }
}
