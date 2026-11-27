import type { Dispatch } from 'react'
import { removeWorkingFile, writeWorkingFile } from '../engine/files'
import type { SessionAction, SessionState } from '../state/levelSession'
import { CommitGraph } from './CommitGraph'
import { completeCommand } from './completion'
import { FileEditor } from './FileEditor'
import { FileStatus } from './FileStatus'
import { Terminal } from './Terminal'

/** The shared play area: terminal and file editor on the left, graph and file status on the right. */
export function Workspace({
  state,
  dispatch,
}: {
  state: SessionState
  dispatch: Dispatch<SessionAction>
}) {
  const { world } = state
  return (
    <div className="play-grid">
      <div className="play-main">
        <Terminal
          log={state.log}
          history={state.history}
          onSubmit={(input) => dispatch({ type: 'run', input })}
          complete={(input) =>
            completeCommand(input, { world, allowedCommands: state.config.allowedCommands })
          }
        />
        <FileEditor
          files={world.repo.workingDirectory}
          onSave={(path, content) =>
            dispatch({ type: 'setWorld', world: writeWorkingFile(world, path, content) })
          }
          onDelete={(path) => dispatch({ type: 'setWorld', world: removeWorkingFile(world, path) })}
        />
      </div>
      <div className="play-side">
        <CommitGraph repo={world.repo} />
        <FileStatus repo={world.repo} />
      </div>
    </div>
  )
}
