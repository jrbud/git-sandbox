import { parseArgs } from './args'
import { executeCommand } from './command'
import { GitError, type GitErrorKind } from './errors'
import { parseCommand, type ParsedCommand } from './parser'
import { commandRegistry, UNSIMULATED_GIT_COMMANDS } from './registry'
import type { World } from './types'
import { enforceWhitelist } from './whitelist'

export interface DispatchOptions {
  /** The level's whitelist, e.g. ["git init", "git add", "git commit -m"]. Omit for Free Play. */
  allowedCommands?: readonly string[]
}

export interface DispatchError {
  kind: GitErrorKind
  /** Text that looks like real git's error output. */
  message: string
  /** A short plain-language explanation shown beneath it. */
  explanation: string
}

export type DispatchResult =
  | { ok: true; world: World; output: string; command?: ParsedCommand }
  | { ok: false; world: World; error: DispatchError }

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length]
}

function unknownCommandError(verb: string): GitError {
  if (UNSIMULATED_GIT_COMMANDS.has(verb)) {
    return new GitError(
      `git: '${verb}' is not supported in Git Quest yet`,
      `'git ${verb}' is a real command, but the game doesn't simulate it yet.`,
      'unsupported-command',
    )
  }
  const similar = [...commandRegistry.keys()].filter((name) => editDistance(verb, name) <= 2)
  const hint = similar.length > 0 ? `\n\nThe most similar command is\n\t${similar[0]}` : ''
  return new GitError(
    `git: '${verb}' is not a git command. See 'git --help'.${hint}`,
    similar.length > 0
      ? `Did you mean 'git ${similar[0]}'? Check the spelling.`
      : `There is no git command called '${verb}'.`,
    'unknown-command',
  )
}

/**
 * Run one typed command line against a world. Never throws for player mistakes: failures come
 * back as `{ ok: false }` with the world unchanged.
 */
export function runCommand(
  world: World,
  input: string,
  options: DispatchOptions = {},
): DispatchResult {
  if (input.trim() === '') return { ok: true, world, output: '' }
  try {
    const parsed = parseCommand(input)
    const definition = commandRegistry.get(parsed.verb)
    if (!definition) throw unknownCommandError(parsed.verb)
    if (options.allowedCommands) {
      enforceWhitelist(
        definition,
        parseArgs(definition.name, parsed.args, definition.flags),
        options.allowedCommands,
      )
    }
    const result = executeCommand(world, definition, parsed.args)
    return { ok: true, world: result.world, output: result.output, command: parsed }
  } catch (error) {
    if (!(error instanceof GitError)) throw error
    return {
      ok: false,
      world,
      error: { kind: error.kind, message: error.message, explanation: error.explanation },
    }
  }
}

/** Run several command lines in order, stopping at the first failure. Handy for tests and levels. */
export function runCommands(
  world: World,
  inputs: readonly string[],
  options: DispatchOptions = {},
): DispatchResult {
  let result: DispatchResult = { ok: true, world, output: '' }
  for (const input of inputs) {
    result = runCommand(result.world, input, options)
    if (!result.ok) return result
  }
  return result
}
