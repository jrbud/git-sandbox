import { useState } from 'react'

export interface HintPanelProps {
  hints: string[]
  kind: 'main' | 'variation'
  /** How many hints are revealed. Held by the session so it survives Reset. */
  shown: number
  /** Called when the player reveals the next hint (used to record hint use for mastery). */
  onReveal(): void
}

/**
 * Hints from vague to exact, one at a time. On main levels the button is always visible; on
 * variations it sits behind a "Need help?" toggle, since using a hint affects mastery.
 */
export function HintPanel({ hints, kind, shown, onReveal }: HintPanelProps) {
  const [expanded, setExpanded] = useState(kind === 'main' || shown > 0)
  if (hints.length === 0) return null
  const remaining = hints.length - shown

  return (
    <section className="hint-panel" aria-label="Hints">
      {!expanded ? (
        <button type="button" className="link-button" onClick={() => setExpanded(true)}>
          Need help?
        </button>
      ) : (
        <>
          {kind === 'variation' && shown === 0 && (
            <p className="hint-note">
              Using a hint on a practice level still counts, but marks it as mastered with
              assistance.
            </p>
          )}
          {shown > 0 && (
            <ol className="hint-list" aria-live="polite">
              {hints.slice(0, shown).map((hint, index) => (
                <li key={index}>
                  <span className="hint-label">Hint {index + 1}:</span> {hint}
                </li>
              ))}
            </ol>
          )}
          <button
            type="button"
            className="toolbar-button"
            onClick={onReveal}
            disabled={remaining === 0}
          >
            <span aria-hidden="true">💡 </span>
            {remaining === 0 ? 'No more hints' : shown === 0 ? 'Show a hint' : 'Show next hint'}
          </button>
        </>
      )}
    </section>
  )
}
