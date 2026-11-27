import { describe, expect, it } from 'vitest'
import type { Commit, Repo, RemoteRepo, World } from '../../src/engine/types'

// Step 1: the core types compile and a hand-built sample repo type-checks.
describe('core types', () => {
  it('accept a hand-built sample repository', () => {
    const commit: Commit = {
      id: 'a'.repeat(40),
      parents: [],
      message: 'Initial commit',
      treeSnapshot: new Map([['README.md', 'hello\n']]),
      timestamp: 1767225600,
      author: { name: 'Sam', email: 'sam@example.com' },
    }
    const remote: RemoteRepo = {
      initialized: true,
      commits: new Map([[commit.id, commit]]),
      branches: new Map([['main', commit.id]]),
      HEAD: { type: 'branch', ref: 'main' },
      workingDirectory: new Map(),
      stagingArea: new Map(),
      remotes: new Map(),
      remoteBranches: new Map(),
      upstreams: new Map(),
      config: new Map(),
    }
    const repo: Repo = {
      ...remote,
      workingDirectory: new Map(commit.treeSnapshot),
      stagingArea: new Map(commit.treeSnapshot),
      remotes: new Map([['origin', { name: 'origin', url: 'https://example.com/demo.git' }]]),
      remoteBranches: new Map([['origin/main', commit.id]]),
      upstreams: new Map([['main', { remote: 'origin', branch: 'main' }]]),
    }
    const world: World = {
      repo,
      servers: new Map([['https://example.com/demo.git', remote]]),
      globalConfig: new Map(),
      clock: 1767225660,
    }

    expect(world.repo.branches.get('main')).toBe(commit.id)
    expect(world.repo.HEAD).toEqual({ type: 'branch', ref: 'main' })
    expect(world.servers.get('https://example.com/demo.git')?.commits.size).toBe(1)
  })

  it('model a detached HEAD by commit id', () => {
    const head: Repo['HEAD'] = { type: 'detached', ref: 'b'.repeat(40) }
    expect(head.type).toBe('detached')
  })
})
