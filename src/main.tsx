import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App, { type AppProps } from './App.tsx'
import { createDemoCatalog, createDemoProgress } from './dev/demoSeed'
import { MemoryProgressStore } from './state/progress'

/** In development, ?demo opens a seeded map with mixed progress (kept in memory only). */
function demoProps(): AppProps {
  if (!import.meta.env.DEV || !new URLSearchParams(window.location.search).has('demo')) return {}
  return { catalog: createDemoCatalog(), store: new MemoryProgressStore(createDemoProgress()) }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App {...demoProps()} />
  </StrictMode>,
)
