import { executeCommand, type CommandDefinition } from '../../src/engine/command'
import { GitError } from '../../src/engine/errors'
import { writeWorkingFile } from '../../src/engine/files'
import { createWorld } from '../../src/engine/repo'
import type { World } from '../../src/engine/types'
import { addCommand } from '../../src/engine/commands/add'
import { commitCommand } from '../../src/engine/commands/commit'
import { initCommand } from '../../src/engine/commands/init'

/** A world with a global identity set, so commits work. */
export function freshWorld(): World {
  return createWorld({
    globalConfig: new Map([
      ['user.name', 'Test Player'],
      ['user.email', 'player@example.com'],
    ]),
  })
}

export function run(
  world: World,
  definition: CommandDefinition,
  ...args: string[]
): { world: World; output: string } {
  return executeCommand(world, definition, args)
}

/** Run a command that is expected to fail, and return the GitError it raised. */
export function fail(world: World, definition: CommandDefinition, ...args: string[]): GitError {
  try {
    executeCommand(world, definition, args)
  } catch (error) {
    if (error instanceof GitError) return error
    throw error
  }
  throw new Error(`Expected 'git ${definition.name} ${args.join(' ')}' to fail`)
}

export function write(world: World, files: Record<string, string>): World {
  return Object.entries(files).reduce(
    (w, [path, content]) => writeWorkingFile(w, path, content),
    world,
  )
}

/** An initialized repo. */
export function initialized(): World {
  return run(freshWorld(), initCommand).world
}

/** Write files, stage everything and commit. */
export function commitFiles(world: World, files: Record<string, string>, message: string): World {
  let w = write(world, files)
  w = run(w, addCommand, '.').world
  return run(w, commitCommand, '-m', message).world
}

/** An initialized repo whose main branch has one commit containing `files`. */
export function withCommit(files: Record<string, string> = { 'README.md': 'hello\n' }): World {
  return commitFiles(initialized(), files, 'Initial commit')
}
