import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { completeCommand } from '../../src/components/completion'
import { Terminal } from '../../src/components/Terminal'
import { createSampleLevel } from '../fixtures/sampleLevel'
import { useLevelSession } from '../../src/state/levelSession'
import type { Level } from '../../src/content/types'

/** The Terminal wired to a real level session, so commands go through the engine. */
function Harness({ level }: { level: Level }) {
  const [state, dispatch] = useLevelSession(level)
  return (
    <Terminal
      log={state.log}
      history={state.history}
      onSubmit={(input) => dispatch({ type: 'run', input })}
      complete={(input) =>
        completeCommand(input, { world: state.world, allowedCommands: level.allowedCommands })
      }
    />
  )
}

function setup() {
  const user = userEvent.setup()
  render(<Harness level={createSampleLevel()} />)
  return {
    user,
    input: screen.getByRole('textbox', { name: 'Command' }),
    log: screen.getByRole('log'),
  }
}

// Phase 2 step 2: the Terminal runs commands.
describe('Terminal', () => {
  it('runs a typed command on Enter and shows its output', async () => {
    const { user, input, log } = setup()
    await user.type(input, 'git status{Enter}')
    expect(log).toHaveTextContent('$ git status')
    expect(log).toHaveTextContent('On branch main')
    expect(log).toHaveTextContent('nothing to commit, working tree clean')
    expect(input).toHaveValue('')
  })

  it('shows a git-style error plus a plain-language explanation', async () => {
    const { user, input, log } = setup()
    await user.type(input, 'git branch feature{Enter}')
    expect(log).toHaveTextContent("fatal: 'git branch' is not available in this level")
    expect(log).toHaveTextContent('Error: That')
  })

  it('calls onSubmit with exactly what was typed', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<Terminal log={[]} history={[]} onSubmit={onSubmit} />)
    await user.type(
      screen.getByRole('textbox', { name: 'Command' }),
      'git commit -m "Hi there"{Enter}',
    )
    expect(onSubmit).toHaveBeenCalledWith('git commit -m "Hi there"')
  })

  it('clears the output with "clear"', async () => {
    const { user, input, log } = setup()
    await user.type(input, 'git status{Enter}clear{Enter}')
    expect(log).toBeEmptyDOMElement()
  })
})

// Phase 2 step 3: up-arrow history.
describe('Terminal history', () => {
  it('cycles back through earlier commands with up, and forward with down', async () => {
    const { user, input } = setup()
    await user.type(input, 'git status{Enter}git log{Enter}ls{Enter}')
    await user.type(input, 'draft')
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('ls')
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('git log')
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(input).toHaveValue('git status')
    await user.keyboard('{ArrowDown}')
    expect(input).toHaveValue('git log')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(input).toHaveValue('draft')
  })
})

// Phase 2 step 4: Tab completion limited to the level's allowedCommands.
describe('Terminal Tab completion', () => {
  it('completes a whitelisted git command', async () => {
    const { user, input } = setup()
    await user.type(input, 'git comm')
    await user.keyboard('{Tab}')
    expect(input).toHaveValue('git commit ')
  })

  it('does not offer git commands the level does not allow', async () => {
    const { user, input } = setup()
    await user.type(input, 'git bra')
    await user.keyboard('{Tab}')
    expect(input).toHaveValue('git bra')
  })

  it('lists suggestions when several match', async () => {
    const { user, input } = setup()
    await user.type(input, 'git ')
    await user.keyboard('{Tab}')
    const suggestions = screen.getByText('Suggestions:').parentElement!
    expect(suggestions).toHaveTextContent(/add.*commit.*diff.*log.*status/)
    expect(suggestions).not.toHaveTextContent('branch')
  })

  it('leaves Tab for focus movement on an empty line', async () => {
    const { user, input } = setup()
    input.focus()
    await user.keyboard('{Tab}')
    expect(input).not.toHaveFocus()
  })
})

describe('completeCommand', () => {
  const level = createSampleLevel()
  const context = { world: level.startingState, allowedCommands: level.allowedCommands }

  it('offers git and the file commands for the first word', () => {
    expect(completeCommand('e', context)).toEqual({ value: 'echo ', suggestions: [] })
    expect(completeCommand('g', context).value).toBe('git ')
  })

  it('offers only flags the level allows', () => {
    const restricted = { ...context, allowedCommands: ['git commit -m'] }
    expect(completeCommand('git commit -', restricted)).toEqual({
      value: 'git commit -m ',
      suggestions: [],
    })
    expect(completeCommand('git commit -', context).suggestions).toEqual([
      '--allow-empty',
      '-a',
      '-m',
    ])
  })

  it('completes file names and branch names', () => {
    expect(completeCommand('git add RE', context).value).toBe('git add README.md ')
    expect(completeCommand('cat R', context).value).toBe('cat README.md ')
    const free = { world: level.startingState }
    expect(completeCommand('git switch ma', free).value).toBe('git switch main ')
  })

  it('leaves unknown input alone', () => {
    expect(completeCommand('git zzz', context)).toEqual({ value: 'git zzz', suggestions: [] })
  })
})
