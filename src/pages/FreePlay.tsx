import { useState } from 'react'
import { ResetButton } from '../components/ResetButton'
import { Workspace } from '../components/Workspace'
import { createFreePlayWorld, PLAYGROUND_URL } from '../content/freePlay'
import { useLevelSession } from '../state/levelSession'

/** A sandbox with every command unlocked, no objective and no grading. */
export function FreePlay({ onBackToMap }: { onBackToMap?(): void }) {
  // No allowedCommands and no successPredicate: everything is allowed and nothing is graded.
  const [config] = useState(() => ({ startingState: createFreePlayWorld() }))
  const [state, dispatch] = useLevelSession(config)

  return (
    <div className="play-screen">
      <header className="play-header">
        <section className="objective-banner" aria-label="Free Play">
          <h1 className="objective-title">Free Play</h1>
          <p className="objective-text">
            Every command is unlocked and nothing is graded. Start with <code>git init</code>, or
            copy the practice remote with <code>git clone {PLAYGROUND_URL}</code>.
          </p>
        </section>
        <div className="play-toolbar" role="toolbar" aria-label="Free Play tools">
          {onBackToMap && (
            <button type="button" className="toolbar-button" onClick={onBackToMap}>
              <span aria-hidden="true">← </span>Back to map
            </button>
          )}
          <ResetButton onReset={() => dispatch({ type: 'reset' })} />
        </div>
      </header>
      <Workspace state={state} dispatch={dispatch} />
    </div>
  )
}
