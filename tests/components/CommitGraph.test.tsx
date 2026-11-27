import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CommitGraph } from '../../src/components/CommitGraph'
import { layoutGraph } from '../../src/components/graphLayout'
import { runCommands } from '../../src/engine/dispatcher'
import { createWorld } from '../../src/engine/repo'
import type { World } from '../../src/engine/types'

function build(commands: string[]): World {
  const world = createWorld({
    globalConfig: new Map([
      ['user.name', 'Player'],
      ['user.email', 'p@example.com'],
    ]),
  })
  const result = runCommands(world, commands)
  if (!result.ok) throw new Error(result.error.message)
  return result.world
}

/** main: A - B - M (merge); feature: A - F, merged into main at M. */
const mergedHistory = () =>
  build([
    'git init',
    'echo a > a.txt',
    'git add .',
    'git commit -m "A"',
    'git switch -c feature',
    'echo f > f.txt',
    'git add .',
    'git commit -m "F"',
    'git switch main',
    'echo b > b.txt',
    'git add .',
    'git commit -m "B"',
    'git merge feature',
  ])

// Phase 2 step 5: the CommitGraph visualization.
describe('CommitGraph', () => {
  it('renders one node per commit and one edge per parent link', () => {
    render(<CommitGraph repo={mergedHistory().repo} />)
    expect(screen.getAllByTestId('commit-node')).toHaveLength(4)
    // A<-F, A<-B, B<-M, F<-M
    expect(screen.getAllByTestId('commit-edge')).toHaveLength(4)
  })

  it('marks the commit HEAD points to', () => {
    const world = mergedHistory()
    render(<CommitGraph repo={world.repo} />)
    const markers = screen.getAllByTestId('head-marker')
    expect(markers).toHaveLength(1)
    const headNode = markers[0].closest('[data-testid="commit-node"]')!
    expect(headNode.getAttribute('data-commit')).toBe(world.repo.branches.get('main'))
    expect(headNode).toHaveTextContent('HEAD →')
  })

  it('labels branches by name and gives each lane its own dash pattern, not just a colour', () => {
    render(<CommitGraph repo={mergedHistory().repo} />)
    const refs = screen.getAllByTestId('graph-ref').map((el) => el.textContent?.replace(/^, /, ''))
    expect(refs.sort()).toEqual(['feature', 'main'])

    const dashesByLane = new Map<string, string | null>()
    for (const edge of screen.getAllByTestId('commit-edge')) {
      dashesByLane.set(edge.getAttribute('data-lane')!, edge.getAttribute('stroke-dasharray'))
    }
    expect(dashesByLane.size).toBe(2)
    expect(new Set(dashesByLane.values()).size).toBe(2)
  })

  it('keeps main on one straight lane and puts the feature branch on another', () => {
    const { nodes } = layoutGraph(mergedHistory().repo)
    const byMessage = Object.fromEntries(nodes.map((n) => [n.message, n]))
    expect(byMessage.A.lane).toBe(0)
    expect(byMessage.B.lane).toBe(0)
    expect(byMessage["Merge branch 'feature'"].lane).toBe(0)
    expect(byMessage.F.lane).toBe(1)
    expect(byMessage["Merge branch 'feature'"].isMerge).toBe(true)
  })

  it('describes the graph for screen readers', () => {
    render(<CommitGraph repo={mergedHistory().repo} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Commit graph with 4 commits, HEAD on main',
    )
    const list = screen.getByRole('list', { name: 'Commits, newest first' })
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent(/HEAD, branch main\), merge commit$/)
  })

  it('shows a detached HEAD and remote-tracking refs', () => {
    const world = build([
      'git init',
      'echo a > a.txt',
      'git add .',
      'git commit -m "A"',
      'git commit --allow-empty -m "B"',
      'git checkout HEAD~1',
    ])
    render(<CommitGraph repo={world.repo} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(/HEAD detached/)
    const head = screen.getByTestId('head-marker').closest('[data-testid="commit-node"]')!
    expect(head.getAttribute('data-commit')).toBe(world.repo.HEAD.ref)
  })

  it('explains the empty states', () => {
    const { rerender } = render(<CommitGraph repo={createWorld().repo} />)
    expect(screen.getByText(/Not a git repository yet/)).toBeInTheDocument()
    rerender(<CommitGraph repo={build(['git init']).repo} />)
    expect(screen.getByText(/No commits yet/)).toBeInTheDocument()
  })
})
