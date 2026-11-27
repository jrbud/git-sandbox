import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Cheatsheet } from '../../src/components/Cheatsheet'
import { FileEditor } from '../../src/components/FileEditor'
import { FileStatus } from '../../src/components/FileStatus'
import { HintPanel } from '../../src/components/HintPanel'
import { ObjectiveBanner } from '../../src/components/ObjectiveBanner'
import { ResetButton } from '../../src/components/ResetButton'
import { createSampleLevel } from '../fixtures/sampleLevel'
import { runCommand } from '../../src/engine/dispatcher'
import { removeWorkingFile, writeWorkingFile } from '../../src/engine/files'
import { createSession, sessionReducer, useLevelSession } from '../../src/state/levelSession'

/** FileEditor + FileStatus sharing one level session, as on the play screen. */
function EditorHarness() {
  const [state, dispatch] = useLevelSession(createSampleLevel())
  return (
    <>
      <FileEditor
        files={state.world.repo.workingDirectory}
        onSave={(path, content) =>
          dispatch({ type: 'setWorld', world: writeWorkingFile(state.world, path, content) })
        }
        onDelete={(path) =>
          dispatch({ type: 'setWorld', world: removeWorkingFile(state.world, path) })
        }
      />
      <FileStatus repo={state.world.repo} />
      <output data-testid="status">
        {(runCommand(state.world, 'git status --short') as { output: string }).output}
      </output>
    </>
  )
}

// Phase 2 step 7: the FileEditor panel.
describe('FileEditor', () => {
  it('opens a file, saves an edit, and git sees the change', async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)
    await user.click(screen.getByRole('button', { name: 'README.md' }))
    const textarea = screen.getByRole('textbox', { name: /README\.md/ })
    expect(textarea).toHaveValue('# My project\n')

    await user.type(textarea, 'More text')
    expect(screen.getByText('(unsaved changes)')).toBeInTheDocument()
    expect(screen.getByTestId('status')).toHaveTextContent(/^$/)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByTestId('status')).toHaveTextContent('M README.md')
    const unstaged = screen.getByRole('heading', { name: /Changed but not staged/ }).parentElement!
    expect(within(unstaged).getByText('README.md')).toBeInTheDocument()
  })

  it('creates a new file that shows up as untracked', async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)
    await user.type(screen.getByRole('textbox', { name: 'New file' }), 'docs/notes.txt{Enter}')
    expect(screen.getByRole('button', { name: 'docs/notes.txt' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByTestId('status')).toHaveTextContent('?? docs/notes.txt')
  })

  it('deletes a file, which git reports as deleted', async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)
    await user.click(screen.getByRole('button', { name: 'README.md' }))
    await user.click(screen.getByRole('button', { name: 'Delete README.md' }))
    expect(screen.queryByRole('button', { name: 'README.md' })).not.toBeInTheDocument()
    expect(screen.getByTestId('status')).toHaveTextContent('D README.md')
  })

  it('rejects names outside the project and empty names', async () => {
    const user = userEvent.setup()
    render(<FileEditor files={new Map()} onSave={vi.fn()} onDelete={vi.fn()} />)
    await user.type(screen.getByRole('textbox', { name: 'New file' }), '../evil.txt{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('inside the project folder')
    await user.clear(screen.getByRole('textbox', { name: 'New file' }))
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Type a file name')
  })
})

// Phase 2 step 8: the Cheatsheet panel.
describe('Cheatsheet', () => {
  const entries = createSampleLevel().cheatsheet

  it('opens and closes with its toggle', async () => {
    const user = userEvent.setup()
    render(<Cheatsheet entries={entries} />)
    const toggle = screen.getByRole('button', { name: /Cheatsheet/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('table')).toHaveTextContent('git add <file>')
    await user.click(toggle)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders nothing for levels without a cheatsheet', () => {
    const { container } = render(<Cheatsheet entries={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

// Phase 2 step 9: the HintPanel.
describe('HintPanel', () => {
  const hints = ['Think about staging.', 'Use git add.', 'Run git add notes.txt']

  function Harness({ kind }: { kind: 'main' | 'variation' }) {
    const level = { ...createSampleLevel(), kind, hints }
    const [state, dispatch] = useLevelSession(level)
    return (
      <>
        <HintPanel
          hints={hints}
          kind={kind}
          shown={state.hintsShown}
          onReveal={() => dispatch({ type: 'revealHint' })}
        />
        <output data-testid="shown">{state.hintsShown}</output>
      </>
    )
  }

  it('reveals hints one at a time, in order, on main levels', async () => {
    const user = userEvent.setup()
    render(<Harness kind="main" />)
    await user.click(screen.getByRole('button', { name: /Show a hint/ }))
    expect(screen.getByRole('list')).toHaveTextContent('Hint 1: Think about staging.')
    expect(screen.queryByText(/Use git add/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Show next hint/ }))
    await user.click(screen.getByRole('button', { name: /Show next hint/ }))
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Hint 1: Think about staging.',
      'Hint 2: Use git add.',
      'Hint 3: Run git add notes.txt',
    ])
    expect(screen.getByRole('button', { name: /No more hints/ })).toBeDisabled()
  })

  it('hides the hint button behind "Need help?" on variations, and records that a hint was used', async () => {
    const user = userEvent.setup()
    render(<Harness kind="variation" />)
    expect(screen.queryByRole('button', { name: /Show a hint/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('shown')).toHaveTextContent('0')
    await user.click(screen.getByRole('button', { name: 'Need help?' }))
    await user.click(screen.getByRole('button', { name: /Show a hint/ }))
    expect(screen.getByTestId('shown')).toHaveTextContent('1')
  })

  it('keeps the record of hint use across a level reset', () => {
    let state = createSession(createSampleLevel())
    state = sessionReducer(state, { type: 'revealHint' })
    state = sessionReducer(state, { type: 'reset' })
    expect(state.hintsShown).toBe(1)
  })
})

// Phase 2 step 10: the ObjectiveBanner.
describe('ObjectiveBanner', () => {
  it("renders the level's objective, and a non-colour completion state", () => {
    const { rerender } = render(
      <ObjectiveBanner title="First commit" objective="Commit notes.txt." />,
    )
    expect(screen.getByRole('heading', { name: 'First commit' })).toBeInTheDocument()
    expect(screen.getByText(/Commit notes\.txt\./)).toHaveTextContent('Goal: Commit notes.txt.')
    rerender(<ObjectiveBanner title="First commit" objective="Commit notes.txt." completed />)
    expect(screen.getByText(/Commit notes\.txt\./)).toHaveTextContent('Complete: Commit notes.txt.')
  })
})

// Phase 2 step 11: the Reset Level control.
describe('ResetButton', () => {
  it('calls onReset when clicked', async () => {
    const onReset = vi.fn()
    render(<ResetButton onReset={onReset} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Reset level/ }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('restores the exact starting repo state', () => {
    const level = createSampleLevel()
    let state = createSession(level)
    for (const input of ['echo hi > notes.txt', 'git add notes.txt', 'git commit -m "Notes"']) {
      state = sessionReducer(state, { type: 'run', input })
    }
    expect(state.world).not.toEqual(level.startingState)
    state = sessionReducer(state, { type: 'reset' })
    expect(state.world).toEqual(level.startingState)
    expect(state.world).not.toBe(level.startingState)
    expect(state.log).toEqual([])
    expect(state.completed).toBe(false)
  })
})
