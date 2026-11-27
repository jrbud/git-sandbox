import type { ChangeKind } from '../engine/diff'
import { sortedPaths } from '../engine/files'
import { computeStatus } from '../engine/status'
import type { Repo } from '../engine/types'

const BADGES: Record<ChangeKind, { symbol: string; label: string }> = {
  added: { symbol: '+', label: 'new' },
  modified: { symbol: '~', label: 'modified' },
  deleted: { symbol: '-', label: 'deleted' },
}

function Group({
  title,
  hint,
  items,
}: {
  title: string
  hint: string
  items: Array<{ path: string; kind?: ChangeKind }>
}) {
  const headingId = `files-${title.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="file-group">
      <h3 id={headingId} className="file-group-title">
        {title} <span className="file-count">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="file-group-empty">{hint}</p>
      ) : (
        <ul aria-labelledby={headingId} className="file-list">
          {items.map((item) => (
            <li
              key={`${item.kind ?? 'untracked'}-${item.path}`}
              className={`file-item file-${item.kind ?? 'untracked'}`}
            >
              <span className="file-badge" aria-hidden="true">
                {item.kind ? BADGES[item.kind].symbol : '?'}
              </span>
              <span className="file-path">{item.path}</span>
              <span className="file-kind">{item.kind ? BADGES[item.kind].label : 'untracked'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Where each change lives: staged for the next commit, changed but unstaged, or untracked. */
export function FileStatus({ repo }: { repo: Repo }) {
  if (!repo.initialized) {
    const files = sortedPaths(repo.workingDirectory)
    return (
      <section className="panel file-status" aria-label="Files">
        <h2 className="panel-title">Files</h2>
        <p className="panel-empty">Not a git repository.</p>
        <Group
          title="Files in this folder"
          hint="This folder is empty."
          items={files.map((path) => ({ path }))}
        />
      </section>
    )
  }
  const status = computeStatus(repo)
  const clean = status.staged.length + status.unstaged.length + status.untracked.length === 0
  return (
    <section className="panel file-status" aria-label="Files">
      <h2 className="panel-title">Files</h2>
      {clean && <p className="panel-empty">Working tree clean.</p>}
      <Group
        title="Staged for next commit"
        hint="Nothing staged. Use git add."
        items={status.staged}
      />
      <Group title="Changed but not staged" hint="No unstaged changes." items={status.unstaged} />
      <Group
        title="Untracked"
        hint="No untracked files."
        items={status.untracked.map((path) => ({ path }))}
      />
    </section>
  )
}
