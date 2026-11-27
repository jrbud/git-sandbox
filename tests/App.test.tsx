import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { MemoryProgressStore } from '../src/state/progress'

describe('App', () => {
  it('opens on the level map with the real content, header and theme toggle', async () => {
    render(<App store={new MemoryProgressStore()} />)
    expect(screen.getByText('Git Quest')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Switch to light theme/ })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Choose a level' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Core Basics/ })).toBeInTheDocument()
  })
})
