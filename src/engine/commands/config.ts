import type { CommandDefinition } from '../command'
import { GitError } from '../errors'
import { getConfig } from '../repo'

function checkKey(key: string): string {
  const k = key.toLowerCase()
  if (!k.includes('.') || k.startsWith('.') || k.endsWith('.')) {
    throw new GitError(
      `error: key does not contain a section: ${key}`,
      'Config keys have a section and a name separated by a dot, like user.name.',
      'usage',
    )
  }
  return k
}

export const configCommand: CommandDefinition = {
  name: 'config',
  summary: 'Read or set settings such as user.name and user.email',
  flags: {
    '--global': {},
    '-l': { aliases: ['--list'] },
    '--unset': {},
  },
  requiresRepo: false,
  run(world, args) {
    const global = args.has('--global')
    if (
      !global &&
      !world.repo.initialized &&
      (args.positionals.length > 1 || args.has('--unset'))
    ) {
      throw new GitError(
        'fatal: not in a git directory',
        "Without --global, git config changes this repository's settings, and there is no repository here yet. Use --global, or run git init first.",
      )
    }
    const store = global ? world.globalConfig : world.repo.config

    if (args.has('-l')) {
      const entries = global
        ? [...world.globalConfig]
        : [...world.globalConfig, ...(world.repo.initialized ? world.repo.config : [])]
      return entries.map(([key, value]) => `${key}=${value}`).join('\n')
    }

    const [rawKey, value, ...extra] = args.positionals
    if (rawKey === undefined) {
      throw new GitError(
        'usage: git config [--global] <name> [<value>]',
        'Give a setting name to read it, or a name and a value to set it, like git config user.name "Sam".',
        'usage',
      )
    }
    if (extra.length > 0) {
      throw new GitError(
        'error: wrong number of arguments, should be from 1 to 2',
        'Put quotes around values that contain spaces, like git config user.name "Sam Lee".',
        'usage',
      )
    }
    const key = checkKey(rawKey)
    if (args.has('--unset')) {
      store.delete(key)
      return ''
    }
    if (value === undefined)
      return (global ? world.globalConfig.get(key) : getConfig(world, key)) ?? ''
    store.set(key, value)
    return ''
  },
}
