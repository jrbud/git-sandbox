import { GitError } from './errors'

export interface ParsedCommand {
  /** The program name, always "git" for a successful parse. */
  program: string
  /** The git subcommand, e.g. "commit". */
  verb: string
  /** Everything after the verb, with quotes removed. */
  args: string[]
  raw: string
}

/** Split a command line into words, honouring '...' and "..." quoting like a shell. */
export function tokenize(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inToken = false
  let quote: '"' | "'" | undefined

  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (quote === "'") {
      if (c === "'") quote = undefined
      else current += c
    } else if (quote === '"') {
      if (c === '"') quote = undefined
      else if (c === '\\' && (input[i + 1] === '"' || input[i + 1] === '\\')) current += input[++i]
      else current += c
    } else if (c === '"' || c === "'") {
      quote = c
      inToken = true
    } else if (c === '\\' && i + 1 < input.length) {
      current += input[++i]
      inToken = true
    } else if (/\s/.test(c)) {
      if (inToken) tokens.push(current)
      current = ''
      inToken = false
    } else {
      current += c
      inToken = true
    }
  }
  if (quote) {
    throw new GitError(
      `bash: unexpected EOF while looking for matching \`${quote}'`,
      'A quote was opened but never closed. Every opening quote needs a matching closing one.',
      'parse',
    )
  }
  if (inToken) tokens.push(current)
  return tokens
}

/** Parse a typed `git <verb> [args...]` line. Throws GitError(kind: 'parse') on malformed input. */
export function parseCommand(input: string): ParsedCommand {
  const tokens = tokenize(input)
  if (tokens.length === 0) {
    throw new GitError('', 'Type a git command, like git status.', 'parse')
  }
  const [program, verb, ...args] = tokens
  if (program !== 'git') {
    throw new GitError(
      `${program}: command not found`,
      "This terminal only runs git commands. Start your command with 'git'.",
      'parse',
    )
  }
  if (verb === undefined) {
    throw new GitError(
      'usage: git <command> [<args>]',
      'Add a git command after "git", like git status.',
      'parse',
    )
  }
  return { program, verb, args, raw: input }
}
