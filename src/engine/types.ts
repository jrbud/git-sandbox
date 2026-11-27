/** Core data model for the simulated git engine (spec Section 5). */

export type CommitId = string

/** File path -> file content. Directories are implicit in the paths. */
export type FileMap = Map<string, string>

export interface Author {
  name: string
  email: string
}

export interface Commit {
  id: CommitId
  parents: CommitId[]
  message: string
  /** Full snapshot of every tracked file at this commit. */
  treeSnapshot: FileMap
  /** Simulated seconds since the Unix epoch. */
  timestamp: number
  author: Author
}

export type Head = { type: 'branch'; ref: string } | { type: 'detached'; ref: CommitId }

export interface Remote {
  name: string
  url: string
}

/** The remote branch a local branch tracks, e.g. main -> origin/main. */
export interface Upstream {
  remote: string
  branch: string
}

export interface Repo {
  /** False until `git init` or `git clone` turns the folder into a repository. */
  initialized: boolean
  commits: Map<CommitId, Commit>
  /** Branch name -> the commit it points to. */
  branches: Map<string, CommitId>
  HEAD: Head
  workingDirectory: FileMap
  /** Real git's index: a full snapshot of what the next commit will contain. */
  stagingArea: FileMap
  remotes: Map<string, Remote>
  /** Remote-tracking refs, keyed like "origin/main". */
  remoteBranches: Map<string, CommitId>
  /** Local branch name -> the remote branch it tracks. */
  upstreams: Map<string, Upstream>
  /** Repository-level config (`git config` without --global). */
  config: Map<string, string>
}

/** A remote repository is Repo-shaped; its working directory and staging area are unused. */
export type RemoteRepo = Repo

/** Everything a command can see or change. */
export interface World {
  /** The repository in the player's current folder. */
  repo: Repo
  /** Remote URL -> the repository that lives there. */
  servers: Map<string, RemoteRepo>
  /** `git config --global` values. */
  globalConfig: Map<string, string>
  /** Simulated clock in seconds; each commit advances it, keeping results deterministic. */
  clock: number
}
