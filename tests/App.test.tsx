import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'

describe('App', () => {
  it('renders the Git Quest header, theme toggle and the sample level', () => {
    render(<App />)
    expect(screen.getByText('Git Quest')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Switch to light theme/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Your first commit' })).toBeInTheDocument()
  })
})
