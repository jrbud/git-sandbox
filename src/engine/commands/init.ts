import type { CommandDefinition } from '../command'
import { GitError } from '../errors'
import { createEmptyRepo, REPO_PATH } from '../repo'

export const initCommand: CommandDefinition = {
  name: 'init',
  summary: 'Create an empty Git repository in the current folder',
  flags: {},
  requiresRepo: false,
  run(world, args) {
    if (args.positionals.length > 0) {
      throw new GitError(
        `fatal: cannot create '${args.positionals[0]}': Git Quest only supports 'git init' in the current folder`,
        'In Git Quest you work in a single folder, so run git init with nothing after it.',
        'usage',
      )
    }
    if (world.repo.initialized) return `Reinitialized existing Git repository in ${REPO_PATH}/.git/`
    world.repo = {
      ...createEmptyRepo(),
      initialized: true,
      workingDirectory: world.repo.workingDirectory,
    }
    return `Initialized empty Git repository in ${REPO_PATH}/.git/`
  },
}
