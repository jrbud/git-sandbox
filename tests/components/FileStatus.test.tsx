import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FileStatus } from '../../src/components/FileStatus'
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

function group(name: RegExp) {
  return screen.getByRole('heading', { name }).parentElement!
}

// Phase 2 step 6: the WorkingDirectory/StagingArea view.
describe('FileStatus', () => {
  it('sorts files into staged, unstaged and untracked, with text labels', () => {
    const world = build([
      'git init',
      'echo 1 > tracked.txt',
      'echo 1 > gone.txt',
      'git add .',
      'git commit -m "Start"',
      'echo 2 > tracked.txt',
      'rm gone.txt',
      'echo new > staged.txt',
      'git add staged.txt',
      'echo n > untracked.txt',
    ])
    render(<FileStatus repo={world.repo} />)

    const staged = group(/Staged for next commit/)
    expect(within(staged).getByText('staged.txt').parentElement).toHaveTextContent('new')

    const unstaged = group(/Changed but not staged/)
    expect(within(unstaged).getByText('tracked.txt').parentElement).toHaveTextContent('modified')
    expect(within(unstaged).getByText('gone.txt').parentElement).toHaveTextContent('deleted')

    const untracked = group(/^Untracked/)
    expect(within(untracked).getByText('untracked.txt').parentElement).toHaveTextContent(
      'untracked',
    )
  })

  it('shows a clean working tree', () => {
    render(
      <FileStatus
        repo={build(['git init', 'echo a > a.txt', 'git add .', 'git commit -m "A"']).repo}
      />,
    )
    expect(screen.getByText(/Working tree clean/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Staged for next commit/ })).toHaveTextContent('(0)')
  })

  it('lists plain files before git init', () => {
    render(<FileStatus repo={build(['echo a > a.txt']).repo} />)
    expect(screen.getByText(/Not a git repository/)).toBeInTheDocument()
    expect(screen.getByText('a.txt')).toBeInTheDocument()
  })
})
