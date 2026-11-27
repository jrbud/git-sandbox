import { useEffect, useRef, useState } from 'react'
import { getCatalog } from './content/catalog'
import type { ContentCatalog } from './content/types'
import { FreePlay } from './pages/FreePlay'
import { LevelSelect } from './pages/LevelSelect'
import { PlayScreen } from './pages/PlayScreen'
import { createDefaultProgressStore, type ProgressStore } from './state/progress'
import { useProgress } from './state/progressContext'
import { ProgressProvider } from './state/ProgressProvider'
import { nextLevel } from './state/progression'
import { ThemeProvider } from './theme/ThemeProvider'
import { ThemeToggle } from './theme/ThemeToggle'

type Screen = { name: 'map' } | { name: 'level'; levelId: string } | { name: 'free-play' }

function Game({ catalog }: { catalog: ContentCatalog }) {
  const { progress, loaded, recordCompletion } = useProgress()
  const [screen, setScreen] = useState<Screen>({ name: 'map' })
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // Move focus to the new screen so keyboard and screen-reader users land in the right place.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    mainRef.current?.focus()
  }, [screen])

  const toMap = () => setScreen({ name: 'map' })
  let content
  if (!loaded) {
    content = <p className="panel-empty">Loading your progress…</p>
  } else if (screen.name === 'level') {
    const level = catalog.levels.get(screen.levelId)!
    const next = nextLevel(level, catalog, progress)
    content = (
      <PlayScreen
        key={level.id}
        level={level}
        onComplete={(result) => recordCompletion(level.id, result)}
        onNextLevel={next ? () => setScreen({ name: 'level', levelId: next.id }) : undefined}
        onBackToMap={toMap}
      />
    )
  } else if (screen.name === 'free-play') {
    content = <FreePlay onBackToMap={toMap} />
  } else {
    content = (
      <LevelSelect
        catalog={catalog}
        progress={progress}
        onSelectLevel={(levelId) => setScreen({ name: 'level', levelId })}
        onFreePlay={() => setScreen({ name: 'free-play' })}
      />
    )
  }

  return (
    <main id="main" className="app-main" ref={mainRef} tabIndex={-1}>
      {content}
    </main>
  )
}

export interface AppProps {
  /** Defaults to the bundled content files. */
  catalog?: ContentCatalog
  /** Defaults to localStorage (or memory if storage is unavailable). */
  store?: ProgressStore
}

function App({ catalog: catalogProp, store: storeProp }: AppProps) {
  const [catalog] = useState(() => catalogProp ?? getCatalog())
  const [store] = useState(() => storeProp ?? createDefaultProgressStore())
  return (
    <ThemeProvider>
      <ProgressProvider store={store}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <header className="app-header">
          <p className="app-title">Git Quest</p>
          <ThemeToggle />
        </header>
        <Game catalog={catalog} />
      </ProgressProvider>
    </ThemeProvider>
  )
}

export default App
