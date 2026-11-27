import { cloneCommand } from '../../src/engine/commands/clone'
import { pushCommand } from '../../src/engine/commands/push'
import { createWorld } from '../../src/engine/repo'
import type { World } from '../../src/engine/types'
import { commitFiles, freshWorld, run, withCommit } from './helpers'

export const URL = 'https://example.com/team/project.git'

/** A player world (no repo yet) next to a server that has one commit on main. */
export function worldWithServer(files: Record<string, string> = { 'README.md': 'hello\n' }): World {
  const source = withCommit(files)
  const server = { ...source.repo, workingDirectory: new Map(), stagingArea: new Map() }
  return { ...freshWorld(), servers: new Map([[URL, server]]), clock: source.clock }
}

/** A player who has cloned the server. */
export function cloned(files?: Record<string, string>): World {
  return run(worldWithServer(files), cloneCommand, URL).world
}

/** Simulate a teammate cloning, committing and pushing, sharing the same servers. */
export function teammatePushes(
  world: World,
  files: Record<string, string>,
  message: string,
): World {
  let teammate: World = createWorld({
    servers: world.servers,
    clock: world.clock,
    globalConfig: new Map([
      ['user.name', 'Teammate'],
      ['user.email', 'teammate@example.com'],
    ]),
  })
  teammate = run(teammate, cloneCommand, URL).world
  teammate = commitFiles(teammate, files, message)
  teammate = run(teammate, pushCommand).world
  return { ...world, servers: teammate.servers, clock: teammate.clock }
}
