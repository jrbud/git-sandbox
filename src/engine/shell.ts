import { parseArgs, type Args, type FlagSpec } from './args'
import { GitError } from './errors'
import { normalizePath } from './files'
import type { Redirect } from './parser'
import { cloneWorld } from './repo'
import type { FileMap, World } from './types'

/**
 * Basic file commands the terminal accepts alongside git, so players can create and change
 * files. They work on the simulated working directory and are never limited by a level's
 * allowedCommands. Directories are implicit: writing "src/app.js" creates "src".
 */
export interface ShellCommand {
  name: string
  summary: string
  flags: FlagSpec
  /** Whether `> file` / `>> file` may follow the command. */
  allowsRedirect: boolean
  run(world: World, args: Args, redirect: Redirect | undefined): string
}

function shellError(message: string, explanation: string): GitError {
  return new GitError(message, explanation, 'fatal')
}

/** Validate a path typed in the terminal. Paths outside the project folder are refused. */
function checkPath(command: string, raw: string): string {
  const path = normalizePath(raw)
  if (path === '' || path.split('/').some((part) => part === '..' || part === '.git')) {
    throw shellError(
      `${command}: ${raw}: Permission denied`,
      'In Git Quest you can only work with files inside the project folder.',
    )
  }
  return path
}

function isDirectory(files: FileMap, path: string): boolean {
  const prefix = path === '' ? '' : `${path}/`
  return [...files.keys()].some((file) => file.startsWith(prefix))
}

function missingOperand(command: string, example: string): GitError {
  return shellError(`${command}: missing file operand`, `Say which file to use, like: ${example}`)
}

const touch: ShellCommand = {
  name: 'touch',
  summary: 'Create an empty file',
  flags: {},
  allowsRedirect: false,
  run(world, args) {
    if (args.positionals.length === 0) throw missingOperand('touch', 'touch notes.txt')
    const files = world.repo.workingDirectory
    for (const raw of args.positionals) {
      const path = checkPath('touch', raw)
      if (isDirectory(files, path)) continue
      if (!files.has(path)) files.set(path, '')
    }
    return ''
  },
}

const echo: ShellCommand = {
  name: 'echo',
  summary: 'Print text, or write it to a file with > (overwrite) or >> (append)',
  flags: {},
  allowsRedirect: true,
  run(world, args, redirect) {
    const text = args.positionals.join(' ')
    if (!redirect) return text
    const files = world.repo.workingDirectory
    const path = checkPath('bash', redirect.path)
    if (isDirectory(files, path)) {
      throw shellError(
        `bash: ${redirect.path}: Is a directory`,
        `'${redirect.path}' is a folder, not a file.`,
      )
    }
    const line = `${text}\n`
    files.set(path, redirect.mode === '>>' ? `${files.get(path) ?? ''}${line}` : line)
    return ''
  },
}

const cat: ShellCommand = {
  name: 'cat',
  summary: "Show a file's contents",
  flags: {},
  allowsRedirect: false,
  run(world, args) {
    if (args.positionals.length === 0) throw missingOperand('cat', 'cat notes.txt')
    const files = world.repo.workingDirectory
    return args.positionals
      .map((raw) => {
        const path = checkPath('cat', raw)
        const content = files.get(path)
        if (content !== undefined) return content.replace(/\n$/, '')
        if (isDirectory(files, path)) {
          throw shellError(
            `cat: ${raw}: Is a directory`,
            `'${raw}' is a folder. Use ls ${raw} to see what's in it.`,
          )
        }
        throw shellError(
          `cat: ${raw}: No such file or directory`,
          `There's no file called '${raw}'. Use ls to see the files.`,
        )
      })
      .join('\n')
  },
}

const ls: ShellCommand = {
  name: 'ls',
  summary: 'List files (folders end with /)',
  flags: { '-a': { aliases: ['--all'] } },
  allowsRedirect: false,
  run(world, args) {
    const files = world.repo.workingDirectory
    const raw = args.positionals[0] ?? '.'
    const dir = normalizePath(raw)
    if (dir !== '' && files.has(dir)) return dir
    if (dir !== '' && !isDirectory(files, dir)) {
      throw shellError(
        `ls: cannot access '${raw}': No such file or directory`,
        `There's no file or folder called '${raw}'.`,
      )
    }
    const prefix = dir === '' ? '' : `${dir}/`
    const entries = new Set<string>()
    for (const path of files.keys()) {
      if (!path.startsWith(prefix)) continue
      const rest = path.slice(prefix.length)
      const slash = rest.indexOf('/')
      entries.add(slash === -1 ? rest : `${rest.slice(0, slash)}/`)
    }
    const visible = [...entries].filter((name) => args.has('-a') || !name.startsWith('.')).sort()
    const all =
      args.has('-a') && dir === '' && world.repo.initialized ? ['.git/', ...visible] : visible
    return all.join('  ')
  },
}

const rm: ShellCommand = {
  name: 'rm',
  summary: 'Delete a file (rm -r for a folder)',
  flags: { '-r': { aliases: ['-R', '--recursive'] }, '-f': { aliases: ['--force'] } },
  allowsRedirect: false,
  run(world, args) {
    if (args.positionals.length === 0) throw missingOperand('rm', 'rm notes.txt')
    const files = world.repo.workingDirectory
    for (const raw of args.positionals) {
      const path = checkPath('rm', raw)
      if (files.has(path)) {
        files.delete(path)
      } else if (isDirectory(files, path)) {
        if (!args.has('-r')) {
          throw shellError(
            `rm: cannot remove '${raw}': Is a directory`,
            `'${raw}' is a folder. Use rm -r ${raw} to delete it and everything in it.`,
          )
        }
        for (const file of [...files.keys()]) if (file.startsWith(`${path}/`)) files.delete(file)
      } else if (!args.has('-f')) {
        throw shellError(
          `rm: cannot remove '${raw}': No such file or directory`,
          `There's no file called '${raw}'. Use ls to see the files.`,
        )
      }
    }
    return ''
  },
}

export const SHELL_COMMANDS: readonly ShellCommand[] = [touch, echo, cat, ls, rm]

export const shellRegistry: ReadonlyMap<string, ShellCommand> = new Map(
  SHELL_COMMANDS.map((command) => [command.name, command]),
)

/** Run a shell command on a copy of the world; the input world is never modified. */
export function executeShellCommand(
  world: World,
  command: ShellCommand,
  tokens: string[],
  redirect: Redirect | undefined,
): { world: World; output: string } {
  if (redirect && !command.allowsRedirect) {
    throw shellError(
      `bash: Git Quest only supports > and >> with echo`,
      'Use echo to write text into a file, like: echo "hello" > notes.txt',
    )
  }
  // echo treats every word as text, including ones that start with "-".
  const args =
    command.name === 'echo'
      ? parseArgs('echo', ['--', ...tokens], {})
      : parseArgs(command.name, tokens, command.flags)
  const draft = cloneWorld(world)
  const output = command.run(draft, args, redirect)
  return { world: draft, output }
}
