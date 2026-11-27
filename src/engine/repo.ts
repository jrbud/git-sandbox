import { GitError } from './errors'
import { hashString } from './hash'
import type { Author, Commit, CommitId, FileMap, Repo, World } from './types'

export const DEFAULT_BRANCH = 'main'
/** Where the simulated repository "lives", used in git-style output. */
export const REPO_PATH = '/project'
/** 2026-01-01T00:00:00Z. The simulated clock starts here. */
export const BASE_TIMESTAMP = 1767225600
/** Seconds the simulated clock advances per commit. */
export const CLOCK_STEP = 60

export function createEmptyRepo(): Repo {
  return {
    initialized: false,
    commits: new Map(),
    branches: new Map(),
    HEAD: { type: 'branch', ref: DEFAULT_BRANCH },
    workingDirectory: new Map(),
    stagingArea: new Map(),
    remotes: new Map(),
    remoteBranches: new Map(),
    upstreams: new Map(),
    config: new Map(),
  }
}

export function createWorld(overrides: Partial<World> = {}): World {
  return {
    repo: createEmptyRepo(),
    servers: new Map(),
    globalConfig: new Map(),
    clock: BASE_TIMESTAMP,
    ...overrides,
  }
}

/** Deep copy, so a command can change the copy without touching the original. */
export function cloneWorld(world: World): World {
  return structuredClone(world)
}

export function cloneRepo(repo: Repo): Repo {
  return structuredClone(repo)
}

export function headCommitId(repo: Repo): CommitId | undefined {
  return repo.HEAD.type === 'detached' ? repo.HEAD.ref : repo.branches.get(repo.HEAD.ref)
}

/** The checked-out branch name, or undefined when HEAD is detached. */
export function currentBranch(repo: Repo): string | undefined {
  return repo.HEAD.type === 'branch' ? repo.HEAD.ref : undefined
}

export function getCommit(repo: Repo, id: CommitId): Commit {
  const commit = repo.commits.get(id)
  if (!commit) throw new Error(`Commit ${id} is missing from the repository`)
  return commit
}

export function treeOf(repo: Repo, id: CommitId | undefined): FileMap {
  return id === undefined ? new Map() : getCommit(repo, id).treeSnapshot
}

export function headTree(repo: Repo): FileMap {
  return treeOf(repo, headCommitId(repo))
}

/** Point the current branch (or a detached HEAD) at a commit. */
export function moveHead(repo: Repo, id: CommitId): void {
  if (repo.HEAD.type === 'branch') repo.branches.set(repo.HEAD.ref, id)
  else repo.HEAD = { type: 'detached', ref: id }
}

/**
 * Resolve a revision such as `main`, `HEAD`, `origin/main`, `a1b2c3d`, `HEAD~2` or `main^2`.
 * Returns undefined when it names nothing.
 */
export function resolveRevision(repo: Repo, revision: string): CommitId | undefined {
  const match = /^(.+?)((?:[~^]\d*)*)$/.exec(revision)
  if (!match) return undefined
  const [, base, suffixes] = match
  let id = resolveBase(repo, base)
  if (id === undefined) return undefined

  for (const [, op, digits] of suffixes.matchAll(/([~^])(\d*)/g)) {
    const n = digits === '' ? 1 : Number(digits)
    if (op === '~') {
      for (let i = 0; i < n && id !== undefined; i++) id = repo.commits.get(id)?.parents[0]
    } else if (n > 0) {
      id = repo.commits.get(id)?.parents[n - 1]
    }
    if (id === undefined) return undefined
  }
  return id
}

function resolveBase(repo: Repo, name: string): CommitId | undefined {
  if (name === 'HEAD' || name === '@') return headCommitId(repo)
  if (repo.branches.has(name)) return repo.branches.get(name)
  const remoteName = name.startsWith('remotes/') ? name.slice('remotes/'.length) : name
  if (repo.remoteBranches.has(remoteName)) return repo.remoteBranches.get(remoteName)
  if (/^[0-9a-f]{4,40}$/.test(name)) {
    const matches = [...repo.commits.keys()].filter((id) => id.startsWith(name))
    if (matches.length === 1) return matches[0]
  }
  return undefined
}

/** Rules from `git check-ref-format`, simplified to what players are likely to type. */
export function isValidBranchName(name: string): boolean {
  if (name === '' || name === '@' || name === 'HEAD') return false
  if (name.startsWith('-') || name.startsWith('/') || name.endsWith('/')) return false
  if (name.endsWith('.') || name.endsWith('.lock')) return false
  if (name.includes('..') || name.includes('@{') || name.includes('//')) return false
  if (/[\s~^:?*[\\]/.test(name)) return false
  if ([...name].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return false
  return name.split('/').every((part) => part !== '' && !part.startsWith('.'))
}

/** Config lookup: repository config wins over global config. Keys are case-insensitive. */
export function getConfig(world: World, key: string): string | undefined {
  const k = key.toLowerCase()
  return world.repo.config.get(k) ?? world.globalConfig.get(k)
}

export function requireAuthor(world: World): Author {
  const name = getConfig(world, 'user.name')
  const email = getConfig(world, 'user.email')
  if (name && email) return { name, email }
  throw new GitError(
    [
      'Author identity unknown',
      '',
      '*** Please tell me who you are.',
      '',
      'Run',
      '',
      '  git config --global user.email "you@example.com"',
      '  git config --global user.name "Your Name"',
      '',
      "to set your account's default identity.",
      'Omit --global to set the identity only in this repository.',
      '',
      `fatal: ${email ? 'empty ident name not allowed' : 'unable to auto-detect email address'}`,
    ].join('\n'),
    'Git records who made every commit, so it needs your name and email first. Set them with git config user.name and git config user.email.',
  )
}

function serializeTree(tree: FileMap): string {
  return [...tree.keys()]
    .sort()
    .map((path) => `${path}\0${tree.get(path)}`)
    .join('\n')
}

/** Create a commit from the current clock, store it in the repo and advance the clock. */
export function createCommit(
  world: World,
  input: { parents: CommitId[]; message: string; tree: FileMap; author: Author },
): Commit {
  const timestamp = world.clock
  world.clock += CLOCK_STEP
  const tree = new Map(input.tree)
  const id = hashString(
    [
      `tree ${serializeTree(tree)}`,
      ...input.parents.map((p) => `parent ${p}`),
      `author ${input.author.name} <${input.author.email}> ${timestamp}`,
      '',
      input.message,
    ].join('\n'),
  )
  const commit: Commit = {
    id,
    parents: [...input.parents],
    message: input.message,
    treeSnapshot: tree,
    timestamp,
    author: { ...input.author },
  }
  world.repo.commits.set(id, commit)
  return commit
}

/** "Thu Jan 1 00:00:00 2026 +0000", the way `git log` prints dates. */
export function formatGitDate(timestamp: number): string {
  const d = new Date(timestamp * 1000)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${d.getUTCDate()} ${time} ${d.getUTCFullYear()} +0000`
}

export function firstLine(message: string): string {
  return message.split('\n')[0]
}
