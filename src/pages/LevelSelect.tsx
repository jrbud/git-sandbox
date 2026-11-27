import { useState } from 'react'
import {
  mainLevel,
  variations,
  type Concept,
  type ContentCatalog,
  type Level,
} from '../content/types'
import { isLevelComplete, type Progress } from '../state/progress'
import { progressColor } from '../theme/progressColor'
import {
  conceptMastery,
  isLevelUnlocked,
  isSectionUnlocked,
  MASTERY_LABELS,
  sectionProgress,
} from '../state/progression'

export interface LevelSelectProps {
  catalog: ContentCatalog
  progress: Progress
  onSelectLevel(levelId: string): void
  onFreePlay(): void
}

type TaskStatus = 'Completed' | 'Not started' | 'Locked'

function taskStatus(level: Level, catalog: ContentCatalog, progress: Progress): TaskStatus {
  if (isLevelComplete(progress, level.id)) return 'Completed'
  return isLevelUnlocked(level, catalog, progress) ? 'Not started' : 'Locked'
}

function TaskRow({
  level,
  label,
  catalog,
  progress,
  onSelect,
}: {
  level: Level
  label: string
  catalog: ContentCatalog
  progress: Progress
  onSelect(id: string): void
}) {
  const status = taskStatus(level, catalog, progress)
  const name = `${label}: ${level.title}`
  return (
    <tr
      className={`task-row is-${status.toLowerCase().replace(' ', '-')}`}
      data-testid={`level-${level.id}`}
    >
      <td className="task-name">{name}</td>
      <td className="task-status" data-testid="status">
        {status}
      </td>
      <td className="task-action">
        <button
          type="button"
          disabled={status === 'Locked'}
          onClick={() => onSelect(level.id)}
          aria-label={`Start ${name}`}
        >
          Start
        </button>
      </td>
    </tr>
  )
}

/**
 * One collapsible box per concept. The header shows its name, mastery and completion percentage.
 * Opened, the left half explains the concept and the commands it needs; the right half lists its
 * tasks. Concepts in progress start open; finished and locked ones start closed.
 */
function ConceptBox({
  concept,
  index,
  catalog,
  progress,
  onSelect,
}: {
  concept: Concept
  index: number
  catalog: ContentCatalog
  progress: Progress
  onSelect(id: string): void
}) {
  const locked = !isLevelUnlocked(mainLevel(concept), catalog, progress)
  const mastery = locked ? 'Locked' : MASTERY_LABELS[conceptMastery(concept, progress)]
  const done = concept.levels.filter((level) => isLevelComplete(progress, level.id)).length
  const percent = Math.round((done / concept.levels.length) * 100)
  const [open, setOpen] = useState(!locked && percent < 100)
  const commands = mainLevel(concept).cheatsheet
  return (
    <details
      className={`concept-box${locked ? ' is-locked' : ''}`}
      data-testid={`concept-${concept.id}`}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="concept-heading">
        <span className="concept-name">
          {index + 1}. {concept.title}
        </span>
        <span className="concept-mastery" data-testid="mastery">
          {mastery}
        </span>
        <span
          className="concept-percent"
          data-testid="percent"
          style={{ color: progressColor(percent) }}
        >
          {percent}%<span className="sr-only"> complete</span>
        </span>
      </summary>
      <div className="concept-body">
        <div className="concept-info">
          <p className="concept-summary">{concept.summary}</p>
          {commands.length > 0 && (
            <>
              <p className="concept-info-title">Commands</p>
              <dl className="concept-commands">
                {commands.map((entry) => (
                  <div key={entry.command} className="concept-command">
                    <dt>
                      <code>{entry.command}</code>
                    </dt>
                    <dd>{entry.description}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
        <div className="concept-tasks">
          <table className="task-table">
            <thead className="sr-only">
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              <TaskRow
                level={mainLevel(concept)}
                label="Lesson"
                catalog={catalog}
                progress={progress}
                onSelect={onSelect}
              />
              {variations(concept).map((level, i) => (
                <TaskRow
                  key={level.id}
                  level={level}
                  label={`Practice ${i + 1}`}
                  catalog={catalog}
                  progress={progress}
                  onSelect={onSelect}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  )
}

/** Every section in order, with one line per task: its name, its status and a Start button. */
export function LevelSelect({ catalog, progress, onSelectLevel, onFreePlay }: LevelSelectProps) {
  return (
    <div className="level-select">
      <div className="level-select-intro">
        <h1>Choose a level</h1>
        <button type="button" className="toolbar-button" onClick={onFreePlay}>
          Free Play
        </button>
      </div>
      {catalog.sections.map((section) => {
        const unlocked = isSectionUnlocked(section, catalog, progress)
        const { completed, total } = sectionProgress(section, catalog, progress)
        const headingId = `section-${section.id}`
        return (
          <section
            key={section.id}
            className={`task-section${unlocked ? '' : ' is-locked'}`}
            aria-labelledby={headingId}
          >
            <header className="task-section-header">
              <h2 id={headingId}>
                {section.title}
                {!unlocked && <span className="task-section-locked"> (locked)</span>}
              </h2>
              <p>{section.description}</p>
              <div className="progress-row">
                <div
                  className="progress-bar"
                  role="progressbar"
                  aria-label={`${section.title} progress`}
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={completed}
                  aria-valuetext={`${completed} of ${total} lessons complete`}
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
                  />
                </div>
                <span className="progress-text">
                  {completed} / {total} lessons
                </span>
              </div>
            </header>
            <div className="concept-list">
              {section.conceptIds.map((id, index) => (
                <ConceptBox
                  key={id}
                  concept={catalog.concepts.get(id)!}
                  index={index}
                  catalog={catalog}
                  progress={progress}
                  onSelect={onSelectLevel}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
