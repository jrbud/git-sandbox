import { useId, useState } from 'react'
import { normalizePath, sortedPaths } from '../engine/files'
import type { FileMap } from '../engine/types'

export interface FileEditorProps {
  files: FileMap
  onSave(path: string, content: string): void
  onDelete(path: string): void
}

function validateNewPath(raw: string, files: FileMap): string | { error: string } {
  const path = normalizePath(raw.trim())
  if (path === '') return { error: 'Type a file name, like notes.txt.' }
  if (path.split('/').some((part) => part === '..' || part === '.git' || part === '.')) {
    return { error: 'Files must stay inside the project folder.' }
  }
  if ([...files.keys()].some((file) => file.startsWith(`${path}/`))) {
    return { error: `"${path}" is a folder. Pick a file name inside it, like ${path}/notes.txt.` }
  }
  return path
}

/** Open, edit, create and delete files in the simulated working directory. */
export function FileEditor({ files, onSave, onDelete }: FileEditorProps) {
  const [selected, setSelected] = useState<string | null>(null)
  /** Unsaved text for the selected file; null means "showing what's on disk". */
  const [draft, setDraft] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const textareaId = useId()
  const newNameId = useId()
  const errorId = useId()

  const paths = sortedPaths(files)
  const open = selected !== null && files.has(selected) ? selected : null
  const text = draft ?? (open ? files.get(open)! : '')
  const dirty = open !== null && draft !== null && draft !== files.get(open)

  function select(path: string) {
    setSelected(path)
    setDraft(null)
    setError('')
  }

  function create() {
    const result = validateNewPath(newName, files)
    if (typeof result !== 'string') {
      setError(result.error)
      return
    }
    if (!files.has(result)) onSave(result, '')
    setNewName('')
    select(result)
  }

  return (
    <section className="panel file-editor" aria-label="File editor">
      <h2 className="panel-title">File editor</h2>
      <div className="file-editor-body">
        <nav aria-label="Project files" className="file-editor-list">
          {paths.length === 0 ? (
            <p className="panel-empty">No files yet.</p>
          ) : (
            <ul>
              {paths.map((path) => (
                <li key={path}>
                  <button
                    type="button"
                    className="file-editor-file"
                    aria-current={path === open ? 'true' : undefined}
                    onClick={() => select(path)}
                  >
                    {path}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="file-editor-new"
            onSubmit={(event) => {
              event.preventDefault()
              create()
            }}
          >
            <label htmlFor={newNameId}>New file</label>
            <div className="file-editor-new-row">
              <input
                id={newNameId}
                value={newName}
                onChange={(event) => {
                  setNewName(event.target.value)
                  setError('')
                }}
                placeholder="notes.txt"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                spellCheck={false}
              />
              <button type="submit">Create</button>
            </div>
            {error && (
              <p id={errorId} className="form-error" role="alert">
                <span aria-hidden="true">✖ </span>
                {error}
              </p>
            )}
          </form>
        </nav>
        <div className="file-editor-pane">
          {open === null ? (
            <p className="panel-empty">Pick a file to view or edit it.</p>
          ) : (
            <>
              <label htmlFor={textareaId} className="file-editor-label">
                {open}
                {dirty && <span className="file-editor-dirty"> (unsaved changes)</span>}
              </label>
              <textarea
                id={textareaId}
                className="file-editor-text"
                value={text}
                onChange={(event) => setDraft(event.target.value)}
                spellCheck={false}
                rows={8}
              />
              <div className="file-editor-actions">
                <button
                  type="button"
                  disabled={!dirty}
                  onClick={() => {
                    onSave(open, text)
                    setDraft(null)
                  }}
                >
                  Save
                </button>
                <button type="button" disabled={!dirty} onClick={() => setDraft(null)}>
                  Discard changes
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    onDelete(open)
                    setSelected(null)
                    setDraft(null)
                  }}
                >
                  Delete {open}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
