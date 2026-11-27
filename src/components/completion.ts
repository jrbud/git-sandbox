import { commandRegistry } from '../engine/registry'
import { SHELL_COMMANDS } from '../engine/shell'
import type { World } from '../engine/types'

export interface CompletionResult {
  /** The input with the last word completed (or extended to the longest shared prefix). */
  value: string
  /** All candidates when more than one matches. */
  suggestions: string[]
}

export interface CompletionContext {
  world: World
  /** The level's whitelist. Omit for Free Play (everything is allowed). */
  allowedCommands?: readonly string[]
}

const BRANCH_VERBS = new Set(['checkout', 'switch', 'branch', 'merge', 'log', 'push', 'pull'])
const FILE_VERBS = new Set(['add', 'diff'])
const REMOTE_VERBS = new Set(['push', 'pull', 'fetch', 'remote'])
const SHELL_FILE_COMMANDS = new Set(['cat', 'rm', 'ls', 'touch'])

function commonPrefix(words: string[]): string {
  let prefix = words[0] ?? ''
  for (const word of words) {
    while (!word.startsWith(prefix)) prefix = prefix.slice(0, -1)
  }
  return prefix
}

/** Parsed allowedCommands entries for one verb: undefined means "everything is allowed". */
function allowedExtras(verb: string, allowed: readonly string[] | undefined): string[] | undefined {
  if (!allowed) return undefined
  const entries = allowed
    .map((entry) => entry.trim().split(/\s+/))
    .filter(([program, v]) => program === 'git' && v === verb)
  if (entries.some((entry) => entry.length === 2)) return undefined
  return entries.flatMap((entry) => entry.slice(2))
}

function allowedVerbs(allowed: readonly string[] | undefined): string[] {
  if (!allowed) return [...commandRegistry.keys()]
  return [
    ...new Set(
      allowed
        .map((entry) => entry.trim().split(/\s+/))
        .filter(([program, verb]) => program === 'git' && verb)
        .map(([, verb]) => verb),
    ),
  ]
}

function gitArgumentCandidates(
  verb: string,
  position: number,
  context: CompletionContext,
): string[] {
  const definition = commandRegistry.get(verb)
  if (!definition) return []
  const repo = context.world.repo
  const extras = allowedExtras(verb, context.allowedCommands)
  const candidates: string[] = []

  if (extras === undefined) {
    candidates.push(...Object.keys(definition.flags))
    if (position === 2) candidates.push(...(definition.subcommands ?? []))
  } else {
    candidates.push(...extras.filter((e) => e.startsWith('-')))
    if (position === 2) candidates.push(...extras.filter((e) => !e.startsWith('-')))
  }
  if (BRANCH_VERBS.has(verb))
    candidates.push(...repo.branches.keys(), ...repo.remoteBranches.keys())
  if (REMOTE_VERBS.has(verb) && verb !== 'remote') candidates.push(...repo.remotes.keys())
  if (FILE_VERBS.has(verb))
    candidates.push(...repo.workingDirectory.keys(), ...repo.stagingArea.keys())
  return candidates
}

/**
 * Tab completion for the terminal. Only offers git commands and flags the level allows, plus
 * the always-available file commands and the names of files, branches and remotes.
 */
export function completeCommand(input: string, context: CompletionContext): CompletionResult {
  const leading = input.match(/^\s*/)![0]
  const body = input.slice(leading.length)
  const words = body.split(/\s+/)
  const partial = words.at(-1) ?? ''
  const position = words.length - 1
  const before = input.slice(0, input.length - partial.length)

  let candidates: string[]
  if (position === 0) {
    candidates = ['git', ...SHELL_COMMANDS.map((c) => c.name)]
  } else if (words[0] === 'git') {
    candidates =
      position === 1
        ? allowedVerbs(context.allowedCommands)
        : gitArgumentCandidates(words[1], position, context)
  } else if (
    SHELL_FILE_COMMANDS.has(words[0]) ||
    words.slice(0, -1).some((w) => w.startsWith('>'))
  ) {
    candidates = [...context.world.repo.workingDirectory.keys()]
  } else {
    candidates = []
  }

  const matches = [...new Set(candidates)].filter((c) => c.startsWith(partial)).sort()
  if (matches.length === 0) return { value: input, suggestions: [] }
  if (matches.length === 1) return { value: `${before}${matches[0]} `, suggestions: [] }
  return { value: `${before}${commonPrefix(matches)}`, suggestions: matches }
}
