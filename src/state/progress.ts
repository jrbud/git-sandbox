/**
 * Saved player progress, behind a swappable storage interface (spec Section 8): localStorage
 * today, an account/sync backend later, an in-memory fake in tests. The interface is async so
 * a network-backed store can drop in without UI changes.
 */

export interface LevelProgress {
  completed: boolean
  /**
   * Whether hints were used. Keeps the best result: once a level is completed without hints,
   * it stays recorded that way even if it is replayed with hints later.
   */
  hintUsed: boolean
}

export interface Progress {
  version: 1
  levels: Record<string, LevelProgress>
}

export interface ProgressStore {
  load(): Promise<Progress>
  save(progress: Progress): Promise<void>
}

export function emptyProgress(): Progress {
  return { version: 1, levels: {} }
}

export function recordCompletion(
  progress: Progress,
  levelId: string,
  result: { hintUsed: boolean },
): Progress {
  const previous = progress.levels[levelId]
  const hintUsed = previous?.completed ? previous.hintUsed && result.hintUsed : result.hintUsed
  return {
    ...progress,
    levels: { ...progress.levels, [levelId]: { completed: true, hintUsed } },
  }
}

export function isLevelComplete(progress: Progress, levelId: string): boolean {
  return progress.levels[levelId]?.completed === true
}

/** Accepts only well-formed saved data; anything else is treated as no progress. */
export function parseProgress(raw: unknown): Progress {
  if (typeof raw !== 'object' || raw === null) return emptyProgress()
  const data = raw as { version?: unknown; levels?: unknown }
  if (data.version !== 1 || typeof data.levels !== 'object' || data.levels === null) {
    return emptyProgress()
  }
  const levels: Record<string, LevelProgress> = {}
  for (const [id, value] of Object.entries(data.levels as Record<string, unknown>)) {
    const entry = value as { completed?: unknown; hintUsed?: unknown } | null
    if (entry && typeof entry.completed === 'boolean' && typeof entry.hintUsed === 'boolean') {
      levels[id] = { completed: entry.completed, hintUsed: entry.hintUsed }
    }
  }
  return { version: 1, levels }
}

export const PROGRESS_STORAGE_KEY = 'git-quest:progress'

/** Persists progress as JSON in browser storage. */
export class LocalStorageProgressStore implements ProgressStore {
  private readonly storage: Storage
  private readonly key: string

  constructor(storage: Storage = window.localStorage, key = PROGRESS_STORAGE_KEY) {
    this.storage = storage
    this.key = key
  }

  async load(): Promise<Progress> {
    try {
      const text = this.storage.getItem(this.key)
      return text === null ? emptyProgress() : parseProgress(JSON.parse(text))
    } catch {
      // Unreadable or corrupt data: start fresh rather than break the game.
      return emptyProgress()
    }
  }

  async save(progress: Progress): Promise<void> {
    this.storage.setItem(this.key, JSON.stringify(progress))
  }
}

/** Keeps progress in memory only. Used in tests and as a fallback when storage is unavailable. */
export class MemoryProgressStore implements ProgressStore {
  private data: Progress

  constructor(initial: Progress = emptyProgress()) {
    this.data = structuredClone(initial)
  }

  async load(): Promise<Progress> {
    return structuredClone(this.data)
  }

  async save(progress: Progress): Promise<void> {
    this.data = structuredClone(progress)
  }
}

export function createDefaultProgressStore(): ProgressStore {
  try {
    const probe = '__git-quest-probe__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return new LocalStorageProgressStore()
  } catch {
    return new MemoryProgressStore()
  }
}
