import { useEffect, useRef } from 'react'
import { Cheatsheet } from '../components/Cheatsheet'
import { CommitGraph } from '../components/CommitGraph'
import { completeCommand } from '../components/completion'
import { FileEditor } from '../components/FileEditor'
import { FileStatus } from '../components/FileStatus'
import { HintPanel } from '../components/HintPanel'
import { ObjectiveBanner } from '../components/ObjectiveBanner'
import { ResetButton } from '../components/ResetButton'
import { Terminal } from '../components/Terminal'
import type { Level } from '../content/types'
import { removeWorkingFile, writeWorkingFile } from '../engine/files'
import { useLevelSession } from '../state/levelSession'

export interface PlayScreenProps {
  level: Level
  /** Shown as a "Next level" button once the objective is met. */
  onNextLevel?(): void
}

export function PlayScreen({ level, onNextLevel }: PlayScreenProps) {
  const [state, dispatch] = useLevelSession(level)
  const completeRef = useRef<HTMLHeadingElement>(null)
  const { world, completed } = state

  useEffect(() => {
    if (completed) completeRef.current?.focus()
  }, [completed])

  return (
    <div className="play-screen">
      <header className="play-header">
        <ObjectiveBanner title={level.title} objective={level.objective} completed={completed} />
        <div className="play-toolbar" role="toolbar" aria-label="Level tools">
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
            <span aria-hidden="true">✔ </span>Level complete!
          </h2>
          {level.successMessage && <p>{level.successMessage}</p>}
          {onNextLevel && (
            <button type="button" className="primary" onClick={onNextLevel}>
              Next level <span aria-hidden="true">→</span>
            </button>
          )}
        </section>
      )}

      <div className="play-grid">
        <div className="play-main">
          <Terminal
            log={state.log}
            history={state.history}
            onSubmit={(input) => dispatch({ type: 'run', input })}
            complete={(input) =>
              completeCommand(input, { world, allowedCommands: level.allowedCommands })
            }
          />
          <FileEditor
            files={world.repo.workingDirectory}
            onSave={(path, content) =>
              dispatch({ type: 'setWorld', world: writeWorkingFile(world, path, content) })
            }
            onDelete={(path) =>
              dispatch({ type: 'setWorld', world: removeWorkingFile(world, path) })
            }
          />
        </div>
        <div className="play-side">
          <CommitGraph repo={world.repo} />
          <FileStatus repo={world.repo} />
        </div>
      </div>
    </div>
  )
}
