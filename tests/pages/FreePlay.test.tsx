import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createFreePlayWorld, PLAYGROUND_URL } from '../../src/content/freePlay'
import { commandRegistry } from '../../src/engine/registry'
import { FreePlay } from '../../src/pages/FreePlay'
import { createSession, sessionReducer } from '../../src/state/levelSession'

// Phase 3 step 5: the Free Play sandbox.
describe('Free Play', () => {
  it('allows every engine command, regardless of any level whitelist', () => {
    let state = createSession({ startingState: createFreePlayWorld() })
    const lines = [
      `git clone ${PLAYGROUND_URL}`,
      'git config user.name "Sam"',
      'git status',
      'git log',
      'git diff',
      'git branch feature',
      'git checkout feature',
      'echo x > x.txt',
      'git add x.txt',
      'git commit -m "x"',
      'git switch main',
      'git merge feature',
      'git remote -v',
      'git fetch',
      'git pull',
      'git push',
    ]
    for (const input of lines) {
      state = sessionReducer(state, { type: 'run', input })
      const entry = state.log.at(-1)!
      expect(entry.error?.kind, `${input}: ${entry.error?.message}`).not.toBe('not-allowed')
      expect(entry.error, `${input}: ${entry.error?.message}`).toBeUndefined()
    }
    const used = new Set(lines.filter((l) => l.startsWith('git ')).map((l) => l.split(' ')[1]))
    // Every simulated git command except init (the clone made the repository) was exercised.
    expect([...commandRegistry.keys()].filter((verb) => !used.has(verb))).toEqual(['init'])
    const init = sessionReducer(createSession({ startingState: createFreePlayWorld() }), {
      type: 'run',
      input: 'git init',
    })
    expect(init.log[0].error).toBeUndefined()
  })

  it('never grades anything or shows an objective', () => {
    let state = createSession({ startingState: createFreePlayWorld() })
    for (const input of ['git init', 'echo a > a.txt', 'git add .', 'git commit -m "a"']) {
      state = sessionReducer(state, { type: 'run', input })
    }
    expect(state.completed).toBe(false)
  })

  it('renders the workspace without objective, hints or "Level complete"', async () => {
    const user = userEvent.setup()
    render(<FreePlay onBackToMap={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Free Play' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Hints' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cheatsheet/ })).not.toBeInTheDocument()
    const input = screen.getByRole('textbox', { name: 'Command' })
    await user.type(input, `git clone ${PLAYGROUND_URL}{Enter}git switch -c idea{Enter}`)
    expect(screen.getByRole('log')).toHaveTextContent("Switched to a new branch 'idea'")
    expect(screen.getAllByTestId('commit-node')).toHaveLength(1)
    expect(screen.queryByText('Level complete!')).not.toBeInTheDocument()
  })
})
