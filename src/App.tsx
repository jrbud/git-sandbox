import { useState } from 'react'
import { createSampleLevel } from './content/sampleLevel'
import { PlayScreen } from './pages/PlayScreen'
import { ThemeProvider } from './theme/ThemeProvider'
import { ThemeToggle } from './theme/ThemeToggle'

function App() {
  const [level] = useState(createSampleLevel)
  return (
    <ThemeProvider>
      <a href="#main" className="skip-link">
        Skip to the level
      </a>
      <header className="app-header">
        <p className="app-title">
          <span aria-hidden="true">⎇ </span>Git Quest
        </p>
        <ThemeToggle />
      </header>
      <main id="main" className="app-main">
        <PlayScreen level={level} />
      </main>
    </ThemeProvider>
  )
}

export default App
