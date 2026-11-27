import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LevelSelect } from '../../src/pages/LevelSelect'
import { emptyProgress, recordCompletion, type Progress } from '../../src/state/progress'
import { makeCatalog } from '../fixtures/catalog'

const catalog = makeCatalog()

function complete(ids: string[], hintUsed = false, progress: Progress = emptyProgress()): Progress {
  return ids.reduce((p, id) => recordCompletion(p, id, { hintUsed }), progress)
}

function renderMap(progress: Progress) {
  const onSelectLevel = vi.fn()
  const onFreePlay = vi.fn()
  render(
    <LevelSelect
      catalog={catalog}
      progress={progress}
      onSelectLevel={onSelectLevel}
      onFreePlay={onFreePlay}
    />,
  )
  return { onSelectLevel, onFreePlay }
}

const cluster = (id: string) => screen.getByTestId(`concept-${id}`)
const lesson = (id: string) => within(cluster(id)).getByRole('button', { name: /^Lesson:/ })

// Phase 3 step 4: the level-select map.
describe('LevelSelect', () => {
  it('shows locked concepts as locked until their prerequisite is complete', () => {
    renderMap(emptyProgress())
    expect(lesson('alpha')).toBeEnabled()
    expect(lesson('beta')).toBeDisabled()
    expect(lesson('beta')).toHaveAccessibleName(/Locked\.$/)
    expect(within(cluster('beta')).getByTestId('mastery')).toHaveTextContent('Locked')
    expect(within(cluster('alpha')).getByRole('button', { name: /^Practice 1/ })).toBeDisabled()
  })

  it('unlocks the next concept and the practice levels after a lesson', () => {
    renderMap(complete(['alpha.main']))
    expect(lesson('alpha')).toHaveAccessibleName(/Completed\.$/)
    expect(lesson('beta')).toBeEnabled()
    expect(lesson('gamma')).toBeDisabled()
    expect(within(cluster('alpha')).getByRole('button', { name: /^Practice 1/ })).toBeEnabled()
  })

  it('shows mastery indicators that match stored mastery', () => {
    let progress = complete(['alpha.main', 'alpha.var1', 'alpha.var2', 'beta.main', 'beta.var1'])
    progress = complete(['beta.var2'], true, progress)
    progress = complete(['gamma.main'], false, progress)
    renderMap(progress)
    expect(within(cluster('alpha')).getByTestId('mastery')).toHaveTextContent('★ Mastered')
    expect(within(cluster('beta')).getByTestId('mastery')).toHaveTextContent(
      '☆ Mastered (with assistance)',
    )
    expect(within(cluster('gamma')).getByTestId('mastery')).toHaveTextContent('◐ In progress')
  })

  it('shows section progress from main levels only, and locks later sections', () => {
    renderMap(complete(['alpha.main', 'alpha.var1']))
    const bar = screen.getByRole('progressbar', { name: 'Basics progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '1')
    expect(bar).toHaveAttribute('aria-valuemax', '3')
    expect(screen.getByRole('heading', { name: /Collaboration/ })).toHaveTextContent('(locked)')
    expect(screen.getByRole('heading', { name: /Basics/ })).not.toHaveTextContent('(locked)')
    expect(lesson('delta')).toBeDisabled()
  })

  it('opens a level or Free Play when chosen', async () => {
    const user = userEvent.setup()
    const { onSelectLevel, onFreePlay } = renderMap(emptyProgress())
    await user.click(lesson('alpha'))
    expect(onSelectLevel).toHaveBeenCalledWith('alpha.main')
    await user.click(screen.getByRole('button', { name: /Free Play/ }))
    expect(onFreePlay).toHaveBeenCalled()
  })
})
