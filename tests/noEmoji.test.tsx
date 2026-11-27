import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { MemoryProgressStore } from '../src/state/progress'
import { makeCatalog, SOLUTION } from './fixtures/catalog'

/** Emoji and pictographic symbols. Plain arrows like "->" in git output are fine. */
const EMOJI = /\p{Extended_Pictographic}/u

/** Every source, style and content file, as raw text. */
const sources = import.meta.glob<string>('../src/**/*.{ts,tsx,json,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// Project rule: no emojis anywhere in the UI or the content.
describe('no emojis', () => {
  it('appear in any source or content file', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20)
    const offenders: string[] = []
    for (const [file, text] of Object.entries(sources)) {
      text.split('\n').forEach((line, i) => {
        if (EMOJI.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`)
      })
    }
    expect(offenders).toEqual([])
  })

  it('appear on the map, play screen or Free Play', async () => {
    const user = userEvent.setup()
    render(<App catalog={makeCatalog()} store={new MemoryProgressStore()} />)
    await screen.findByRole('heading', { name: 'Choose a level' })
    expect(document.body.textContent).not.toMatch(EMOJI)

    await user.click(screen.getByRole('button', { name: /^Start Lesson: alpha main/ }))
    await user.click(screen.getByRole('button', { name: /Cheatsheet/ }))
    await user.click(screen.getByRole('button', { name: /Show a hint/ }))
    const input = screen.getByRole('textbox', { name: 'Command' })
    for (const line of ['git nope', ...SOLUTION]) await user.type(input, `${line}{Enter}`)
    expect(document.body.textContent).not.toMatch(EMOJI)

    await user.click(screen.getAllByRole('button', { name: /Back to levels/ })[0])
    await user.click(screen.getByRole('button', { name: /Free Play/ }))
    expect(document.body.textContent).not.toMatch(EMOJI)
  })
})
