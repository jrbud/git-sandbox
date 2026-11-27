import {
  mainLevel,
  variations,
  type Concept,
  type ContentCatalog,
  type Level,
} from '../content/types'
import { isLevelComplete, type Progress } from '../state/progress'
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

function LevelNode({
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
  const unlocked = isLevelUnlocked(level, catalog, progress)
  const done = isLevelComplete(progress, level.id)
  const state = done ? 'Completed' : unlocked ? 'Open' : 'Locked'
  return (
    <button
      type="button"
      className={`map-node map-node-${level.kind} is-${state.toLowerCase()}`}
      disabled={!unlocked}
      onClick={() => onSelect(level.id)}
      aria-label={`${label}: ${level.title}. ${state}.`}
      title={`${level.title} (${state})`}
    >
      <span aria-hidden="true">
        {label}
        {state !== 'Open' && <span className="map-node-state"> {state.toLowerCase()}</span>}
      </span>
    </button>
  )
}

function ConceptCluster({
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
  const mastery = conceptMastery(concept, progress)
  const main = mainLevel(concept)
  const locked = !isLevelUnlocked(main, catalog, progress)
  return (
    <li
      className={`map-concept${locked ? ' is-locked' : ''}`}
      data-testid={`concept-${concept.id}`}
    >
      <div className="map-concept-header">
        <h3 className="map-concept-title">
          <span className="map-concept-number">{index + 1}.</span> {concept.title}
        </h3>
        <span className={`mastery mastery-${mastery}`} data-testid="mastery">
          {locked ? 'Locked' : MASTERY_LABELS[mastery]}
        </span>
      </div>
      <div className="map-nodes">
        <LevelNode
          level={main}
          label="Lesson"
          catalog={catalog}
          progress={progress}
          onSelect={onSelect}
        />
        {variations(concept).map((level, i) => (
          <LevelNode
            key={level.id}
            level={level}
            label={`Practice ${i + 1}`}
            catalog={catalog}
            progress={progress}
            onSelect={onSelect}
          />
        ))}
      </div>
    </li>
  )
}

/** The level map: sections, a winding path of concepts, locks and mastery. */
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
            className={`map-section${unlocked ? '' : ' is-locked'}`}
            aria-labelledby={headingId}
          >
            <header className="map-section-header">
              <h2 id={headingId}>
                {section.title}
                {!unlocked && <span className="map-locked-label"> (locked)</span>}
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
            <ol className="map-path">
              {section.conceptIds.map((id, index) => (
                <ConceptCluster
                  key={id}
                  concept={catalog.concepts.get(id)!}
                  index={index}
                  catalog={catalog}
                  progress={progress}
                  onSelect={onSelectLevel}
                />
              ))}
            </ol>
          </section>
        )
      })}
    </div>
  )
}
