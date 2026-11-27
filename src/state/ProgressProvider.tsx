import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  emptyProgress,
  recordCompletion as record,
  type Progress,
  type ProgressStore,
} from './progress'
import { ProgressContext } from './progressContext'

/** Loads progress from the store once, and saves after every change. */
export function ProgressProvider({
  store,
  children,
}: {
  store: ProgressStore
  children: ReactNode
}) {
  const [progress, setProgress] = useState<Progress>(emptyProgress)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    store.load().then((saved) => {
      if (cancelled) return
      setProgress(saved)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [store])

  const recordCompletion = useCallback(
    (levelId: string, result: { hintUsed: boolean }) => {
      setProgress((current) => {
        const next = record(current, levelId, result)
        void store.save(next)
        return next
      })
    },
    [store],
  )

  const value = useMemo(
    () => ({ progress, loaded, recordCompletion }),
    [progress, loaded, recordCompletion],
  )
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}
