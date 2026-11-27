import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { LogEntry } from '../state/levelSession'
import type { CompletionResult } from './completion'

export interface TerminalProps {
  log: LogEntry[]
  /** Previously entered commands, oldest first. */
  history: string[]
  onSubmit(input: string): void
  /** Tab completion. Without it, Tab moves focus as usual. */
  complete?(input: string): CompletionResult
}

const PROMPT = '$'

export function Terminal({ log, history, onSubmit, complete }: TerminalProps) {
  const [value, setValue] = useState('')
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputId = useId()
  const helpId = useId()
  const suggestionsId = useId()

  useEffect(() => {
    const output = outputRef.current
    if (output) output.scrollTop = output.scrollHeight
  }, [log])

  function submit() {
    onSubmit(value)
    setValue('')
    setHistoryIndex(null)
    setDraft('')
    setSuggestions([])
  }

  function recall(index: number | null) {
    setHistoryIndex(index)
    setValue(index === null ? draft : history[index])
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowUp') {
      if (history.length === 0) return
      event.preventDefault()
      if (historyIndex === null) {
        setDraft(value)
        recall(history.length - 1)
      } else {
        recall(Math.max(0, historyIndex - 1))
      }
    } else if (event.key === 'ArrowDown') {
      if (historyIndex === null) return
      event.preventDefault()
      recall(historyIndex + 1 < history.length ? historyIndex + 1 : null)
    } else if (event.key === 'Tab' && complete && value.trim() !== '' && !event.shiftKey) {
      // With an empty line Tab still moves focus, so keyboard users are never trapped here.
      event.preventDefault()
      const result = complete(value)
      setValue(result.value)
      setSuggestions(result.suggestions)
    } else if (event.key === 'Escape') {
      setSuggestions([])
    }
  }

  return (
    <section className="terminal" aria-label="Terminal">
      <div
        ref={outputRef}
        className="terminal-output"
        role="log"
        aria-live="polite"
        aria-label="Terminal output"
        onClick={() => inputRef.current?.focus()}
      >
        {log.map((entry) => (
          <div key={entry.id} className="terminal-entry">
            <div className="terminal-command">
              <span className="terminal-prompt" aria-hidden="true">
                {PROMPT}{' '}
              </span>
              {entry.input}
            </div>
            {entry.output && <pre className="terminal-text">{entry.output}</pre>}
            {entry.error && (
              <div className="terminal-error">
                {entry.error.message && <pre className="terminal-text">{entry.error.message}</pre>}
                <p className="terminal-explanation">
                  <span aria-hidden="true">✖ </span>
                  <span className="sr-only">Error: </span>
                  {entry.error.explanation}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
      <form
        className="terminal-input-row"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label htmlFor={inputId} className="terminal-prompt">
          <span aria-hidden="true">{PROMPT}</span>
          <span className="sr-only">Command</span>
        </label>
        <input
          id={inputId}
          ref={inputRef}
          className="terminal-input"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setSuggestions([])
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={`${helpId} ${suggestionsId}`}
          placeholder="Type a command, like git status"
        />
      </form>
      <p id={helpId} className="sr-only">
        Press Enter to run. Up and down arrows recall earlier commands. Tab completes the current
        word.
      </p>
      <div id={suggestionsId} className="terminal-suggestions" aria-live="polite">
        {suggestions.length > 0 && (
          <>
            <span className="sr-only">Suggestions: </span>
            {suggestions.map((s) => (
              <span key={s} className="terminal-suggestion">
                {s}
              </span>
            ))}
          </>
        )}
      </div>
    </section>
  )
}
