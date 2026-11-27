import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../src/App'
import { MemoryProgressStore } from '../src/state/progress'
import { makeCatalog, SOLUTION } from './fixtures/catalog'

beforeEach(() => {
  window.localStorage.clear()
})

async function solve(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByRole('textbox', { name: 'Command' })
  for (const line of SOLUTION) await user.type(input, `${line}{Enter}`)
  await screen.findByText('Level complete!')
}

const cluster = (id: string) => screen.getByTestId(`concept-${id}`)

// Phase 3 step 6: the full navigation loop.
describe('navigation', () => {
  it('map -> lesson -> complete -> map -> practice -> complete -> mastery, with progress saved', async () => {
    const user = userEvent.setup()
    const store = new MemoryProgressStore()
    render(<App catalog={makeCatalog()} store={store} />)

    // Start on the map, with only the first lesson open.
    await screen.findByRole('heading', { name: 'Choose a level' })
    expect(within(cluster('beta')).getByRole('button', { name: /^Lesson:/ })).toBeDisabled()
    await user.click(within(cluster('alpha')).getByRole('button', { name: /^Lesson:/ }))

    // Play the main level and finish it.
    expect(screen.getByRole('heading', { level: 1, name: 'alpha main' })).toBeInTheDocument()
    await solve(user)
    await waitFor(async () =>
      expect((await store.load()).levels['alpha.main']?.completed).toBe(true),
    )

    // Back on the map: next concept and practice levels are open.
    await user.click(screen.getAllByRole('button', { name: /Back to map/ })[0])
    expect(within(cluster('beta')).getByRole('button', { name: /^Lesson:/ })).toBeEnabled()
    expect(within(cluster('alpha')).getByTestId('mastery')).toHaveTextContent('In progress')
    expect(screen.getByRole('progressbar', { name: 'Basics progress' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    )

    // A practice level, then "Next level" goes straight to the other practice level.
    await user.click(within(cluster('alpha')).getByRole('button', { name: /^Practice 1/ }))
    expect(screen.queryByRole('button', { name: /Cheatsheet/ })).not.toBeInTheDocument()
    await solve(user)
    await user.click(screen.getByRole('button', { name: /Next level/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'alpha practice 2' })).toBeInTheDocument()
    await solve(user)

    // Both practice levels done without hints: mastered.
    await user.click(screen.getAllByRole('button', { name: /Back to map/ })[0])
    expect(within(cluster('alpha')).getByTestId('mastery')).toHaveTextContent('★ Mastered')
    expect(await store.load()).toEqual({
      version: 1,
      levels: {
        'alpha.main': { completed: true, hintUsed: false },
        'alpha.var1': { completed: true, hintUsed: false },
        'alpha.var2': { completed: true, hintUsed: false },
      },
    })
  })

  it('records hint use on a practice level as "with assistance"', async () => {
    const user = userEvent.setup()
    const store = new MemoryProgressStore({
      version: 1,
      levels: {
        'alpha.main': { completed: true, hintUsed: false },
        'alpha.var1': { completed: true, hintUsed: false },
      },
    })
    render(<App catalog={makeCatalog()} store={store} />)
    await user.click(
      await within(await screen.findByTestId('concept-alpha')).findByRole('button', {
        name: /^Practice 2/,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Need help?' }))
    await user.click(screen.getByRole('button', { name: /Show a hint/ }))
    await solve(user)
    await user.click(screen.getAllByRole('button', { name: /Back to map/ })[0])
    expect(within(cluster('alpha')).getByTestId('mastery')).toHaveTextContent(
      'Mastered (with assistance)',
    )
  })

  it('reaches Free Play from the map and returns', async () => {
    const user = userEvent.setup()
    render(<App catalog={makeCatalog()} store={new MemoryProgressStore()} />)
    await user.click(await screen.findByRole('button', { name: /Free Play/ }))
    expect(screen.getByRole('heading', { name: 'Free Play' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveFocus()
    await user.click(screen.getByRole('button', { name: /Back to map/ }))
    expect(screen.getByRole('heading', { name: 'Choose a level' })).toBeInTheDocument()
  })

  it('remembers progress across a reload', async () => {
    const user = userEvent.setup()
    const store = new MemoryProgressStore()
    const { unmount } = render(<App catalog={makeCatalog()} store={store} />)
    await user.click(
      within(await screen.findByTestId('concept-alpha')).getByRole('button', { name: /^Lesson:/ }),
    )
    await solve(user)
    unmount()

    render(<App catalog={makeCatalog()} store={store} />)
    const lesson = within(await screen.findByTestId('concept-alpha')).getByRole('button', {
      name: /^Lesson:/,
    })
    expect(lesson).toHaveAccessibleName(/Completed\.$/)
  })
})
