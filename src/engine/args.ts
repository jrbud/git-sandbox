import { GitError } from './errors'

export interface FlagDef {
  /** The flag consumes a value: `-m "msg"`, `-m"msg"` or `--message=msg`. */
  takesValue?: boolean
  /** Other spellings that mean the same flag, e.g. `--message` for `-m`. */
  aliases?: string[]
  /** Accept `-<number>` as this flag's value (`git log -3`). */
  numericShorthand?: boolean
}

/** Canonical flag spelling -> definition. */
export type FlagSpec = Record<string, FlagDef>

export class Args {
  readonly positionals: string[]
  private readonly flags: Map<string, string[]>

  constructor(flags: Map<string, string[]>, positionals: string[]) {
    this.flags = flags
    this.positionals = positionals
  }

  has(flag: string): boolean {
    return this.flags.has(flag)
  }

  /** Last value given for a flag (git's "last one wins"). */
  value(flag: string): string | undefined {
    return this.flags.get(flag)?.at(-1)
  }

  values(flag: string): string[] {
    return this.flags.get(flag) ?? []
  }

  /** Canonical names of every flag that was used. */
  flagNames(): string[] {
    return [...this.flags.keys()]
  }
}

/** Map any spelling of a flag to its canonical name, or undefined if the command lacks it. */
export function canonicalFlag(spec: FlagSpec, token: string): string | undefined {
  if (token in spec) return token
  return Object.keys(spec).find((name) => spec[name].aliases?.includes(token))
}

function usageError(message: string, command: string): GitError {
  return new GitError(
    message,
    `That option isn't something 'git ${command}' understands here. Check the spelling, or look at the cheatsheet.`,
    'usage',
  )
}

export function parseArgs(command: string, tokens: string[], spec: FlagSpec): Args {
  const flags = new Map<string, string[]>()
  const positionals: string[] = []
  const add = (name: string, value: string) => flags.set(name, [...(flags.get(name) ?? []), value])

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token === '--') {
      positionals.push(...tokens.slice(i + 1))
      break
    }
    if (token === '-' || !token.startsWith('-')) {
      positionals.push(token)
      continue
    }

    if (/^-\d+$/.test(token)) {
      const numeric = Object.keys(spec).find((name) => spec[name].numericShorthand)
      if (!numeric) throw usageError(`error: unknown switch \`${token[1]}'`, command)
      add(numeric, token.slice(1))
      continue
    }

    if (token.startsWith('--')) {
      const eq = token.indexOf('=')
      const name = eq === -1 ? token : token.slice(0, eq)
      const canonical = canonicalFlag(spec, name)
      if (!canonical) throw usageError(`error: unknown option \`${name.slice(2)}'`, command)
      if (spec[canonical].takesValue) {
        if (eq !== -1) add(canonical, token.slice(eq + 1))
        else if (i + 1 < tokens.length) add(canonical, tokens[++i])
        else throw usageError(`error: option \`${name.slice(2)}' requires a value`, command)
      } else {
        if (eq !== -1) throw usageError(`error: option \`${name.slice(2)}' takes no value`, command)
        add(canonical, '')
      }
      continue
    }

    // Short flags, possibly bundled: -am "msg" == -a -m "msg".
    const exact = canonicalFlag(spec, token)
    if (exact && !spec[exact].takesValue) {
      add(exact, '')
      continue
    }
    for (let c = 1; c < token.length; c++) {
      const canonical = canonicalFlag(spec, `-${token[c]}`)
      if (!canonical) throw usageError(`error: unknown switch \`${token[c]}'`, command)
      if (spec[canonical].takesValue) {
        const rest = token.slice(c + 1)
        if (rest !== '') add(canonical, rest)
        else if (i + 1 < tokens.length) add(canonical, tokens[++i])
        else throw usageError(`error: switch \`${token[c]}' requires a value`, command)
        break
      }
      add(canonical, '')
    }
  }

  return new Args(flags, positionals)
}
