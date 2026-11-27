import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { CommitGraph } from '../src/components/CommitGraph'
import { FileStatus } from '../src/components/FileStatus'
import { createSampleLevel } from '../src/content/sampleLevel'
import { runCommands } from '../src/engine/dispatcher'
import { PlayScreen } from '../src/pages/PlayScreen'
import { ThemeProvider } from '../src/theme/ThemeProvider'

async function seriousViolations(container: Element) {
  const results = await axe.run(container, {
    // jsdom cannot compute rendered colours; contrast is checked on the theme tokens instead.
    rules: { 'color-contrast': { enabled: false } },
  })
  return results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)
}

// Phase 2 step 14: accessibility pass on everything built so far.
describe('accessibility', () => {
  it('the whole app has no critical or serious axe violations', async () => {
    const { container } = render(<App />)
    expect(await seriousViolations(container)).toEqual([])
  })

  it('stays clean with every panel open, hints shown and the level complete', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ThemeProvider>
        <PlayScreen level={createSampleLevel()} onNextLevel={() => {}} />
      </ThemeProvider>,
    )
    await user.click(screen.getByRole('button', { name: /Cheatsheet/ }))
    await user.click(screen.getByRole('button', { name: /Show a hint/ }))
    await user.click(screen.getByRole('button', { name: 'README.md' }))
    const input = screen.getByRole('textbox', { name: 'Command' })
    await user.type(
      input,
      'git bogus{Enter}echo hi > notes.txt{Enter}git add .{Enter}git commit -m "Notes"{Enter}',
    )
    expect(screen.getByText('Level complete!')).toBeInTheDocument()
    expect(await seriousViolations(container)).toEqual([])
  })

  it('the graph and file views are clean for a branching history', async () => {
    const level = createSampleLevel()
    const result = runCommands(level.startingState, [
      'git switch -c feature',
      'echo f > f.txt',
      'git add .',
      'git commit -m "F"',
      'git switch main',
      'git merge --no-ff feature',
      'echo x > x.txt',
    ])
    if (!result.ok) throw new Error(result.error.message)
    const { container } = render(
      <>
        <CommitGraph repo={result.world.repo} />
        <FileStatus repo={result.world.repo} />
      </>,
    )
    expect(await seriousViolations(container)).toEqual([])
  })
})

describe('keyboard navigation', () => {
  it('reaches every control with Tab, in a sensible order, without getting stuck in the terminal', async () => {
    const user = userEvent.setup()
    render(<App />)
    const order: string[] = []
    for (let i = 0; i < 12; i++) {
      await user.tab()
      const el = document.activeElement as HTMLElement
      order.push(
        el.tagName === 'INPUT'
          ? `input:${el.getAttribute('placeholder')}`
          : (el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName),
      )
    }
    const position = (pattern: RegExp) => order.findIndex((label) => pattern.test(label))
    expect(position(/Skip to the level/)).toBe(0)
    expect(position(/Switch to light theme/)).toBeGreaterThan(position(/Skip to the level/))
    expect(position(/Cheatsheet/)).toBeGreaterThan(position(/Switch to light theme/))
    expect(position(/Reset level/)).toBeGreaterThan(position(/Cheatsheet/))
    expect(position(/Show a hint/)).toBeGreaterThan(position(/Reset level/))
    // The terminal input is reachable, and Tab on an empty line moves on to the file editor.
    const terminalIndex = position(/^input:Type a command/)
    expect(terminalIndex).toBeGreaterThan(position(/Show a hint/))
    expect(position(/README\.md/)).toBeGreaterThan(terminalIndex)
  })

  it('every action works from the keyboard alone', async () => {
    const user = userEvent.setup()
    render(<App />)
    screen.getByRole('button', { name: /Cheatsheet/ }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('table')).toBeInTheDocument()
    screen.getByRole('textbox', { name: 'Command' }).focus()
    await user.keyboard('echo hi > notes.txt{Enter}')
    screen.getByRole('button', { name: /Reset level/ }).focus()
    await user.keyboard(' ')
    expect(screen.queryByRole('button', { name: 'notes.txt' })).not.toBeInTheDocument()
  })
})

describe('colour-independent indicators', () => {
  it('error output carries a text label, not just red', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('textbox', { name: 'Command' }), 'git nope{Enter}')
    expect(screen.getByRole('log')).toHaveTextContent('Error:')
  })
})
