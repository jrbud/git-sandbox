export type GitErrorKind =
  /** The typed text could not be read as a command (bad quoting, not a git command). */
  | 'parse'
  /** `git <verb>` where <verb> is not a git command at all. */
  | 'unknown-command'
  /** A real git command that Git Quest does not simulate. */
  | 'unsupported-command'
  /** A supported command that the current level does not allow. */
  | 'not-allowed'
  /** Wrong flags or arguments for a supported command. */
  | 'usage'
  /** The command was valid but git refused to do it in the current state. */
  | 'fatal'

/**
 * A structured, player-facing failure: `message` looks like real git's output and
 * `explanation` says in plain language what went wrong.
 */
export class GitError extends Error {
  readonly kind: GitErrorKind
  readonly explanation: string

  constructor(message: string, explanation: string, kind: GitErrorKind = 'fatal') {
    super(message)
    this.name = 'GitError'
    this.kind = kind
    this.explanation = explanation
  }
}

export function notARepositoryError(): GitError {
  return new GitError(
    'fatal: not a git repository (or any of the parent directories): .git',
    "This folder isn't a Git repository yet. Run git init to create one, or git clone to copy one.",
  )
}
