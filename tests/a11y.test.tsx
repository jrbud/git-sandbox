import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { CommitGraph } from '../src/components/CommitGraph'
import { FileStatus } from '../src/components/FileStatus'
import { createSampleLevel } from './fixtures/sampleLevel'
import { runCommands } from '../src/engine/dispatcher'
import { PlayScreen } from '../src/pages/PlayScreen'
import { MemoryProgressStore } from '../src/state/progress'
import { ThemeProvider } from '../src/theme/ThemeProvider'
import { makeCatalog } from './fixtures/catalog'

/** The app, opened on the first lesson of the fixture catalog. */
async function openFirstLesson() {
  const user = userEvent.setup()
  const view = render(<App catalog={makeCatalog()} store={new MemoryProgressStore()} />)
  await user.click(await screen.findByRole('button', { name: /^Lesson: alpha main/ }))
  return { user, ...view }
}

async function seriousViolations(container: Element) {
  const results = await axe.run(container, {
    // jsdom cannot compute rendered colours; contrast is checked on the theme tokens instead.
    rules: { 'color-contrast': { enabled: false } },
  })
  return results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)
}

// Phase 2 step 14 (extended in Phase 3): accessibility pass on everything built so far.
describe('accessibility', () => {
  it('the level map has no critical or serious axe violations', async () => {
    const { container } = render(<App catalog={makeCatalog()} store={new MemoryProgressStore()} />)
    await screen.findByRole('heading', { name: 'Choose a level' })
    expect(await seriousViolations(container)).toEqual([])
  })

  it('the play screen and Free Play have no critical or serious axe violations', async () => {
    const { user, container } = await openFirstLesson()
    expect(await seriousViolations(container)).toEqual([])
    await user.click(screen.getAllByRole('button', { name: /Back to map/ })[0])
    await user.click(screen.getByRole('button', { name: /Free Play/ }))
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
    const { user } = await openFirstLesson()
    ;(document.activeElement as HTMLElement).blur()
    const order: string[] = []
    for (let i = 0; i < 14; i++) {
      await user.tab()
      const el = document.activeElement as HTMLElement
      order.push(
        el.tagName === 'INPUT'
          ? `input:${el.getAttribute('placeholder')}`
          : (el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName),
      )
    }
    const position = (pattern: RegExp) => order.findIndex((label) => pattern.test(label))
    expect(position(/Skip to content/)).toBe(0)
    expect(position(/Switch to light theme/)).toBeGreaterThan(position(/Skip to content/))
    expect(position(/Back to map/)).toBeGreaterThan(position(/Switch to light theme/))
    expect(position(/Cheatsheet/)).toBeGreaterThan(position(/Back to map/))
    expect(position(/Reset level/)).toBeGreaterThan(position(/Cheatsheet/))
    expect(position(/Show a hint/)).toBeGreaterThan(position(/Reset level/))
    // The terminal input is reachable, and Tab on an empty line moves on to the file editor.
    const terminalIndex = position(/^input:Type a command/)
    expect(terminalIndex).toBeGreaterThan(position(/Show a hint/))
    expect(position(/README\.md/)).toBeGreaterThan(terminalIndex)
  })

  it('every action works from the keyboard alone', async () => {
    const { user } = await openFirstLesson()
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
    const { user } = await openFirstLesson()
    await user.type(screen.getByRole('textbox', { name: 'Command' }), 'git nope{Enter}')
    expect(screen.getByRole('log')).toHaveTextContent('Error:')
  })
})
