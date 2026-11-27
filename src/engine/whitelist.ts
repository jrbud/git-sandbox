import { canonicalFlag, type Args } from './args'
import type { CommandDefinition } from './command'
import { GitError } from './errors'

/**
 * A level's `allowedCommands` entries look like "git commit" (every flag allowed),
 * "git commit -m" (only the listed flags allowed) or "git remote add" (only that subcommand).
 */
interface Allowance {
  verb: string
  extras: string[]
}

function parseEntry(entry: string): Allowance | undefined {
  const [program, verb, ...extras] = entry.trim().split(/\s+/)
  if (program !== 'git' || !verb) return undefined
  return { verb, extras }
}

/** Throws a 'not-allowed' GitError if this level does not permit the command as typed. */
export function enforceWhitelist(
  definition: CommandDefinition,
  args: Args,
  allowed: readonly string[],
): void {
  const entries = allowed.map(parseEntry).filter((e): e is Allowance => e?.verb === definition.name)
  const shown = allowed.join(', ')

  if (entries.length === 0) {
    throw new GitError(
      `fatal: 'git ${definition.name}' is not available in this level`,
      `That's a real git command, but this level is about something else. Commands you can use here: ${shown}.`,
      'not-allowed',
    )
  }
  if (entries.some((e) => e.extras.length === 0)) return

  const allowedFlags = new Set<string>()
  const allowedSubcommands = new Set<string>()
  let bareSubcommandAllowed = false
  for (const entry of entries) {
    const subcommand = entry.extras.find((token) => !token.startsWith('-'))
    if (subcommand) allowedSubcommands.add(subcommand)
    else bareSubcommandAllowed = true
    for (const token of entry.extras.filter((t) => t.startsWith('-'))) {
      allowedFlags.add(canonicalFlag(definition.flags, token) ?? token)
    }
  }

  if (definition.subcommands && allowedSubcommands.size > 0) {
    const sub = args.positionals[0]
    const ok = sub === undefined ? bareSubcommandAllowed : allowedSubcommands.has(sub)
    if (!ok) {
      throw new GitError(
        `fatal: 'git ${definition.name}${sub ? ` ${sub}` : ''}' is not available in this level`,
        `This level only allows: ${shown}.`,
        'not-allowed',
      )
    }
  }

  const blocked = args.flagNames().filter((flag) => !allowedFlags.has(flag))
  if (blocked.length > 0) {
    throw new GitError(
      `fatal: option '${blocked[0]}' is not available in this level`,
      `That option works in real git, but this level wants you to practise without it. Allowed here: ${shown}.`,
      'not-allowed',
    )
  }
}
