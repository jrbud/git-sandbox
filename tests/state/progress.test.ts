import { beforeEach, describe, expect, it } from 'vitest'
import {
  emptyProgress,
  LocalStorageProgressStore,
  MemoryProgressStore,
  PROGRESS_STORAGE_KEY,
  recordCompletion,
  type ProgressStore,
} from '../../src/state/progress'

beforeEach(() => {
  window.localStorage.clear()
})

// Phase 3 step 1: save/progress behind a swappable interface.
describe('LocalStorageProgressStore', () => {
  it('reads back what was written, even from a new instance (a simulated reload)', async () => {
    const before = new LocalStorageProgressStore()
    const progress = recordCompletion(emptyProgress(), 'core.commit.main', { hintUsed: false })
    await before.save(progress)

    const afterReload = new LocalStorageProgressStore()
    expect(await afterReload.load()).toEqual(progress)
  })

  it('starts empty when nothing is saved, or when saved data is corrupt', async () => {
    expect(await new LocalStorageProgressStore().load()).toEqual(emptyProgress())
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, '{not json')
    expect(await new LocalStorageProgressStore().load()).toEqual(emptyProgress())
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 99, levels: {} }))
    expect(await new LocalStorageProgressStore().load()).toEqual(emptyProgress())
  })

  it('drops malformed entries but keeps good ones', async () => {
    window.localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        levels: { good: { completed: true, hintUsed: false }, bad: { completed: 'yes' } },
      }),
    )
    expect(await new LocalStorageProgressStore().load()).toEqual({
      version: 1,
      levels: { good: { completed: true, hintUsed: false } },
    })
  })
})

describe('swappable stores', () => {
  it.each([
    ['localStorage', () => new LocalStorageProgressStore()],
    ['in-memory fake', () => new MemoryProgressStore()],
  ])('%s satisfies the same ProgressStore contract', async (_, make: () => ProgressStore) => {
    const store = make()
    expect(await store.load()).toEqual(emptyProgress())
    const progress = recordCompletion(emptyProgress(), 'a', { hintUsed: true })
    await store.save(progress)
    expect(await store.load()).toEqual(progress)
  })

  it('the in-memory store hands out copies, so callers cannot change saved data by accident', async () => {
    const store = new MemoryProgressStore()
    const loaded = await store.load()
    loaded.levels.x = { completed: true, hintUsed: false }
    expect(await store.load()).toEqual(emptyProgress())
  })
})

describe('recordCompletion', () => {
  it('records completion and hint use', () => {
    const p = recordCompletion(emptyProgress(), 'a', { hintUsed: true })
    expect(p.levels.a).toEqual({ completed: true, hintUsed: true })
  })

  it('keeps the best result when a level is replayed', () => {
    let p = recordCompletion(emptyProgress(), 'a', { hintUsed: true })
    p = recordCompletion(p, 'a', { hintUsed: false })
    expect(p.levels.a.hintUsed).toBe(false)
    p = recordCompletion(p, 'a', { hintUsed: true })
    expect(p.levels.a.hintUsed).toBe(false)
  })
})
