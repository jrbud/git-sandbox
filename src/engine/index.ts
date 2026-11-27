/**
 * Git simulation engine: repo model, command handlers, parser/dispatcher and predicate
 * evaluator. Framework-agnostic TypeScript with no React or browser dependencies.
 */
export type * from './types'
export { GitError, type GitErrorKind } from './errors'
export {
  createEmptyRepo,
  createWorld,
  cloneWorld,
  headCommitId,
  currentBranch,
  resolveRevision,
} from './repo'
export { writeWorkingFile, removeWorkingFile, readWorkingFile } from './files'
export { computeStatus, type RepoStatus, type StatusEntry } from './status'
export { stagedChanges, unstagedChanges } from './commands/diff'
export { parseCommand, tokenize, type ParsedCommand } from './parser'
export { COMMANDS, commandRegistry } from './registry'
export { runCommand, runCommands, type DispatchOptions, type DispatchResult } from './dispatcher'
export { evaluatePredicate, type Predicate } from './predicates'

export const MODULE_NAME = 'engine'
