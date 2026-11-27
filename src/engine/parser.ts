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

export interface Redirect {
  /** ">" overwrites the file, ">>" appends to it. */
  mode: '>' | '>>'
  path: string
}

/** Any typed line: a program, its arguments and an optional output redirect. */
export interface ParsedLine {
  program: string
  args: string[]
  redirect?: Redirect
  raw: string
}

export interface Token {
  text: string
  /** True for an unquoted shell operator such as ">" or ">>". */
  operator: boolean
}

/**
 * Split a command line into words like a shell: '...' and "..." quoting, backslash escapes,
 * and unquoted ">" / ">>" as separate operator tokens.
 */
export function tokenizeLine(input: string): Token[] {
  const tokens: Token[] = []
  let current = ''
  let inToken = false
  let quote: '"' | "'" | undefined
  const flush = () => {
    if (inToken) tokens.push({ text: current, operator: false })
    current = ''
    inToken = false
  }

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
    } else if (c === '>') {
      flush()
      const append = input[i + 1] === '>'
      if (append) i++
      tokens.push({ text: append ? '>>' : '>', operator: true })
    } else if (/\s/.test(c)) {
      flush()
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
  flush()
  return tokens
}

/** Words of a command line, with quotes removed. */
export function tokenize(input: string): string[] {
  return tokenizeLine(input).map((token) => token.text)
}

/** Parse any typed line into program, arguments and redirect. Throws GitError(kind: 'parse'). */
export function parseLine(input: string): ParsedLine {
  const tokens = tokenizeLine(input)
  if (tokens.length === 0) {
    throw new GitError('', 'Type a command, like git status.', 'parse')
  }
  const operatorIndex = tokens.findIndex((token) => token.operator)
  const words = (operatorIndex === -1 ? tokens : tokens.slice(0, operatorIndex)).map((t) => t.text)
  let redirect: Redirect | undefined
  if (operatorIndex !== -1) {
    const target = tokens[operatorIndex + 1]
    if (!target || target.operator) {
      throw new GitError(
        "bash: syntax error near unexpected token `newline'",
        'Put a file name after > or >>, like: echo "hello" > notes.txt',
        'parse',
      )
    }
    if (tokens.length > operatorIndex + 2) {
      throw new GitError(
        'bash: Git Quest supports one redirect at the end of a command',
        'Write the output to a single file at the end, like: echo "hello" > notes.txt',
        'parse',
      )
    }
    redirect = { mode: tokens[operatorIndex].text as Redirect['mode'], path: target.text }
  }
  if (words.length === 0) {
    throw new GitError(
      "bash: syntax error near unexpected token `>'",
      'Start with a command, like: echo "hello" > notes.txt',
      'parse',
    )
  }
  const [program, ...args] = words
  return { program, args, redirect, raw: input }
}

/** Parse a typed `git <verb> [args...]` line. Throws GitError(kind: 'parse') on malformed input. */
export function parseCommand(input: string): ParsedCommand {
  const line = parseLine(input)
  return toGitCommand(line)
}

/** Interpret an already-parsed line as a git command. */
export function toGitCommand(line: ParsedLine): ParsedCommand {
  if (line.program !== 'git') {
    throw new GitError(
      `${line.program}: command not found`,
      "This terminal runs git commands plus a few file commands (touch, echo, cat, ls, rm). Start git commands with 'git'.",
      'parse',
    )
  }
  if (line.redirect) {
    throw new GitError(
      `bash: Git Quest can't redirect git output to a file`,
      'Run the git command on its own, without > or >>.',
      'parse',
    )
  }
  const [verb, ...args] = line.args
  if (verb === undefined) {
    throw new GitError(
      'usage: git <command> [<args>]',
      'Add a git command after "git", like git status.',
      'parse',
    )
  }
  return { program: 'git', verb, args, raw: line.raw }
}
