import { createContext, useContext } from 'react'
import type { Progress } from './progress'

export interface ProgressContextValue {
  progress: Progress
  /** False until saved progress has been read from the store. */
  loaded: boolean
  recordCompletion(levelId: string, result: { hintUsed: boolean }): void
}

export const ProgressContext = createContext<ProgressContextValue | null>(null)

export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext)
  if (!context) throw new Error('useProgress must be used inside <ProgressProvider>')
  return context
}
