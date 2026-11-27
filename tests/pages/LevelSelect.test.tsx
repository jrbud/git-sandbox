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

function renderList(progress: Progress) {
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

const row = (levelId: string) => screen.getByTestId(`level-${levelId}`)
const status = (levelId: string) => within(row(levelId)).getByTestId('status')
const start = (levelId: string) => within(row(levelId)).getByRole('button', { name: /^Start / })
const mastery = (conceptId: string) =>
  within(screen.getByTestId(`concept-${conceptId}`)).getByTestId('mastery')

// Phase 3 step 4: the level-select screen (a plain list: one line per task).
describe('LevelSelect', () => {
  it('lists every section in order, with one line per task', () => {
    renderList(emptyProgress())
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Basics', 'Collaboration (locked)'])
    expect(screen.getAllByTestId(/^level-/)).toHaveLength(catalog.levels.size)
    expect(row('alpha.main')).toHaveTextContent('Lesson: alpha main')
    expect(row('alpha.var1')).toHaveTextContent('Practice 1: alpha practice 1')
  })

  it('shows each task as Not started, Completed or Locked, with a Start button', () => {
    renderList(complete(['alpha.main']))
    expect(status('alpha.main')).toHaveTextContent('Completed')
    expect(status('alpha.var1')).toHaveTextContent('Not started')
    expect(status('beta.main')).toHaveTextContent('Not started')
    expect(status('gamma.main')).toHaveTextContent('Locked')
    expect(start('alpha.main')).toBeEnabled()
    expect(start('alpha.var1')).toBeEnabled()
    expect(start('gamma.main')).toBeDisabled()
  })

  it('locks tasks until their prerequisite is complete', () => {
    renderList(emptyProgress())
    expect(start('alpha.main')).toBeEnabled()
    expect(start('alpha.var1')).toBeDisabled()
    expect(start('beta.main')).toBeDisabled()
    expect(mastery('beta')).toHaveTextContent('Locked')
  })

  it('shows mastery for each concept that matches stored progress', () => {
    let progress = complete(['alpha.main', 'alpha.var1', 'alpha.var2', 'beta.main', 'beta.var1'])
    progress = complete(['beta.var2'], true, progress)
    progress = complete(['gamma.main'], false, progress)
    renderList(progress)
    expect(mastery('alpha')).toHaveTextContent(/^Mastered$/)
    expect(mastery('beta')).toHaveTextContent('Mastered (with assistance)')
    expect(mastery('gamma')).toHaveTextContent('In progress')
  })

  it('shows section progress from lessons only, and locks later sections', () => {
    renderList(complete(['alpha.main', 'alpha.var1']))
    const bar = screen.getByRole('progressbar', { name: 'Basics progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '1')
    expect(bar).toHaveAttribute('aria-valuemax', '3')
    expect(start('delta.main')).toBeDisabled()
  })

  it('starts a task or Free Play when chosen', async () => {
    const user = userEvent.setup()
    const { onSelectLevel, onFreePlay } = renderList(emptyProgress())
    await user.click(start('alpha.main'))
    expect(onSelectLevel).toHaveBeenCalledWith('alpha.main')
    await user.click(screen.getByRole('button', { name: 'Free Play' }))
    expect(onFreePlay).toHaveBeenCalled()
  })
})

describe('LevelSelect collapsible concepts', () => {
  const box = (conceptId: string) => screen.getByTestId(`concept-${conceptId}`)
  const percent = (conceptId: string) => within(box(conceptId)).getByTestId('percent')

  it('shows each concept as a percentage of its tasks completed', () => {
    // alpha: 3 tasks, all done. beta: 1 of 3. gamma: none.
    renderList(complete(['alpha.main', 'alpha.var1', 'alpha.var2', 'beta.main']))
    expect(percent('alpha')).toHaveTextContent('100% complete')
    expect(percent('beta')).toHaveTextContent('33% complete')
    expect(percent('gamma')).toHaveTextContent('0% complete')
  })

  it('starts concepts in progress open, and finished or locked ones closed', () => {
    renderList(complete(['alpha.main', 'alpha.var1', 'alpha.var2', 'beta.main']))
    expect(box('alpha')).not.toHaveAttribute('open')
    expect(box('beta')).toHaveAttribute('open')
    expect(box('gamma')).toHaveAttribute('open')
    expect(box('delta')).not.toHaveAttribute('open')
  })

  it('opens and closes when its header is clicked', async () => {
    const user = userEvent.setup()
    renderList(emptyProgress())
    const header = within(box('alpha')).getByText('1. Alpha')
    expect(box('alpha')).toHaveAttribute('open')
    await user.click(header)
    expect(box('alpha')).not.toHaveAttribute('open')
    await user.click(header)
    expect(box('alpha')).toHaveAttribute('open')
  })
})

describe('LevelSelect percentage colour', () => {
  it('colours 0% as normal text, part-done in a yellow-to-green blend, and 100% green', () => {
    renderList(complete(['alpha.main', 'alpha.var1', 'alpha.var2', 'beta.main']))
    const colour = (id: string) =>
      within(screen.getByTestId(`concept-${id}`))
        .getByTestId('percent')
        .getAttribute('style')
    expect(colour('gamma')).toContain('var(--color-text)')
    expect(colour('beta')).toContain('var(--color-progress)')
    expect(colour('alpha')).toContain('var(--color-success)')
  })
})

describe('LevelSelect concept details', () => {
  it('shows the concept summary and the commands it needs beside its tasks', () => {
    renderList(emptyProgress())
    const box = screen.getByTestId('concept-alpha')
    const info = box.querySelector('.concept-info') as HTMLElement
    const tasks = box.querySelector('.concept-tasks') as HTMLElement
    expect(info).toHaveTextContent('What alpha does.')
    expect(within(info).getByText('git add <file>')).toBeInTheDocument()
    expect(within(info).getByText('Stage a file for the next commit')).toBeInTheDocument()
    expect(within(tasks).getByTestId('level-alpha.main')).toBeInTheDocument()
    expect(within(info).queryByRole('button')).not.toBeInTheDocument()
  })
})
