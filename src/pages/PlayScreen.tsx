import { useEffect, useRef } from 'react'
import { Cheatsheet } from '../components/Cheatsheet'
import { HintPanel } from '../components/HintPanel'
import { ObjectiveBanner } from '../components/ObjectiveBanner'
import { ResetButton } from '../components/ResetButton'
import { Workspace } from '../components/Workspace'
import type { Level } from '../content/types'
import { useLevelSession } from '../state/levelSession'

export interface PlayScreenProps {
  level: Level
  /** Called once each time the objective is met, with whether any hint was revealed. */
  onComplete?(result: { hintUsed: boolean }): void
  /** Shown as a "Next level" button once the objective is met. */
  onNextLevel?(): void
  /** Shown as a "Back to map" button. */
  onBackToMap?(): void
}

export function PlayScreen({ level, onComplete, onNextLevel, onBackToMap }: PlayScreenProps) {
  const [state, dispatch] = useLevelSession(level)
  const completeRef = useRef<HTMLHeadingElement>(null)
  const { completed } = state
  const onCompleteRef = useRef(onComplete)
  const hintUsedRef = useRef(false)

  useEffect(() => {
    onCompleteRef.current = onComplete
    hintUsedRef.current = state.hintsShown > 0
  })

  useEffect(() => {
    if (!completed) return
    completeRef.current?.focus()
    onCompleteRef.current?.({ hintUsed: hintUsedRef.current })
  }, [completed])

  return (
    <div className="play-screen">
      <header className="play-header">
        <ObjectiveBanner title={level.title} objective={level.objective} completed={completed} />
        <div className="play-toolbar" role="toolbar" aria-label="Level tools">
          {onBackToMap && (
            <button type="button" className="toolbar-button" onClick={onBackToMap}>
              Back to map
            </button>
          )}
          {level.kind === 'main' && <Cheatsheet entries={level.cheatsheet} />}
          <ResetButton onReset={() => dispatch({ type: 'reset' })} />
        </div>
        {level.kind === 'main' && level.briefing && (
          <p className="play-briefing">{level.briefing}</p>
        )}
        <HintPanel
          hints={level.hints}
          kind={level.kind}
          shown={state.hintsShown}
          onReveal={() => dispatch({ type: 'revealHint' })}
        />
      </header>

      {completed && (
        <section className="level-complete" aria-labelledby="level-complete-title" role="status">
          <h2 id="level-complete-title" ref={completeRef} tabIndex={-1}>
            Level complete!
          </h2>
          {level.successMessage && <p>{level.successMessage}</p>}
          <div className="level-complete-actions">
            {onNextLevel && (
              <button type="button" className="primary" onClick={onNextLevel}>
                Next level
              </button>
            )}
            {onBackToMap && (
              <button type="button" onClick={onBackToMap}>
                Back to map
              </button>
            )}
          </div>
        </section>
      )}

      <Workspace state={state} dispatch={dispatch} />
    </div>
  )
}
