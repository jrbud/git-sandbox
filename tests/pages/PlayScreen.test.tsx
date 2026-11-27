import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createSampleLevel } from '../../src/content/sampleLevel'
import { PlayScreen } from '../../src/pages/PlayScreen'

function setup() {
  const user = userEvent.setup()
  const onNextLevel = vi.fn()
  render(<PlayScreen level={createSampleLevel()} onNextLevel={onNextLevel} />)
  const input = screen.getByRole('textbox', { name: 'Command' })
  return { user, input, onNextLevel }
}

// Phase 2 step 12: the full play screen, end to end.
describe('PlayScreen', () => {
  it('shows the objective, terminal, graph, files, editor and level tools', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Your first commit' })).toBeInTheDocument()
    expect(screen.getByText(/Create a file called notes\.txt/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Terminal' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Commit graph' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Files' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'File editor' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cheatsheet/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reset level/ })).toBeInTheDocument()
    expect(screen.getAllByTestId('commit-node')).toHaveLength(1)
  })

  it('reaches "Level complete" after a file edit and the right git commands', async () => {
    const { user, input, onNextLevel } = setup()
    await user.type(input, 'echo "my notes" > notes.txt{Enter}')
    expect(screen.queryByText('Level complete!')).not.toBeInTheDocument()
    await user.type(input, 'git add notes.txt{Enter}')
    expect(screen.queryByText('Level complete!')).not.toBeInTheDocument()
    await user.type(input, 'git commit -m "Add notes"{Enter}')

    expect(screen.getByRole('heading', { name: /Level complete!/ })).toHaveFocus()
    expect(screen.getByText(/You staged notes\.txt/)).toBeInTheDocument()
    expect(screen.getAllByTestId('commit-node')).toHaveLength(2)
    expect(screen.getByText(/Complete:/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Next level/ }))
    expect(onNextLevel).toHaveBeenCalled()
  })

  it('also completes when the file is written with the editor panel', async () => {
    const { user, input } = setup()
    await user.type(screen.getByRole('textbox', { name: 'New file' }), 'notes.txt{Enter}')
    await user.type(screen.getByRole('textbox', { name: /^notes\.txt/ }), 'written in the editor')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.type(input, 'git add notes.txt{Enter}git commit -m "Notes"{Enter}')
    expect(screen.getByRole('heading', { name: /Level complete!/ })).toBeInTheDocument()
  })

  it('does not complete from the starting state alone, and Reset undoes progress', async () => {
    const { user, input } = setup()
    expect(screen.queryByText('Level complete!')).not.toBeInTheDocument()
    await user.type(input, 'echo hi > notes.txt{Enter}git add .{Enter}')
    expect(screen.getByRole('heading', { name: /Staged for next commit/ })).toHaveTextContent('(1)')
    await user.click(screen.getByRole('button', { name: /Reset level/ }))
    expect(screen.getByRole('heading', { name: /Staged for next commit/ })).toHaveTextContent('(0)')
    expect(screen.getByRole('log')).toBeEmptyDOMElement()
    expect(screen.queryByRole('button', { name: 'notes.txt' })).not.toBeInTheDocument()
  })
})
