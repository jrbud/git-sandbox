import { runCommands } from '../engine/dispatcher'
import { writeWorkingFile } from '../engine/files'
import { createEmptyRepo, createWorld } from '../engine/repo'
import type { World } from '../engine/types'

/**
 * How a level's starting state is written in JSON: a recipe, not a raw object graph. The engine
 * is deterministic, so running the same setup commands always produces the same repository,
 * which keeps level files short and readable.
 *
 * Example:
 *   {
 *     "servers": ["https://example.com/team/app.git"],
 *     "setup": [
 *       { "workspace": "teammate", "commands": ["git init", "echo hi > a.txt", "git add .",
 *         "git commit -m \"Start\"", "git remote add origin https://example.com/team/app.git",
 *         "git push -u origin main"] },
 *       "git clone https://example.com/team/app.git"
 *     ]
 *   }
 */
export interface RepoSnapshot {
  /**
   * `git config --global` values for the player. Defaults to a ready-made identity; give {}
   * for levels that teach `git config`.
   */
  globalConfig?: Record<string, string>
  /** Files in the player's folder before setup runs. */
  files?: Record<string, string>
  /** Empty remote repositories that exist at these URLs. */
  servers?: string[]
  /** Commands run in order: strings run in the player's folder, objects in another workspace. */
  setup?: SetupStep[]
}

export type SetupStep = string | WorkspaceStep

/** Commands run as someone else (e.g. a teammate pushing), sharing the same remote servers. */
export interface WorkspaceStep {
  workspace: string
  commands: string[]
}

export const DEFAULT_PLAYER_CONFIG = { 'user.name': 'Player', 'user.email': 'player@example.com' }

function identityFor(workspace: string): Map<string, string> {
  const name = workspace[0].toUpperCase() + workspace.slice(1)
  return new Map([
    ['user.name', name],
    ['user.email', `${workspace.toLowerCase()}@example.com`],
  ])
}

function serverRepo() {
  return { ...createEmptyRepo(), initialized: true }
}

/** Build a World from a snapshot recipe. Throws with the failing command if setup breaks. */
export function buildWorld(snapshot: RepoSnapshot = {}): World {
  let player = createWorld({
    globalConfig: new Map(Object.entries(snapshot.globalConfig ?? DEFAULT_PLAYER_CONFIG)),
    servers: new Map((snapshot.servers ?? []).map((url) => [url, serverRepo()])),
  })
  for (const [path, content] of Object.entries(snapshot.files ?? {})) {
    player = writeWorkingFile(player, path, content)
  }

  const workspaces = new Map<string, World>()
  for (const step of snapshot.setup ?? []) {
    if (typeof step === 'string') {
      const result = runCommands(player, [step])
      if (!result.ok) throw new Error(`Setup command "${step}" failed: ${result.error.message}`)
      player = result.world
      continue
    }
    let other =
      workspaces.get(step.workspace) ?? createWorld({ globalConfig: identityFor(step.workspace) })
    // Every workspace shares the same remote servers and clock.
    other = { ...other, servers: player.servers, clock: player.clock }
    const result = runCommands(other, step.commands)
    if (!result.ok) {
      throw new Error(`Setup in workspace "${step.workspace}" failed: ${result.error.message}`)
    }
    workspaces.set(step.workspace, result.world)
    player = { ...player, servers: result.world.servers, clock: result.world.clock }
  }
  return player
}
