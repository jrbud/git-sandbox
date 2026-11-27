import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'

describe('App', () => {
  it('renders the Git Quest heading and greeting', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Git Quest' })).toBeInTheDocument()
    expect(screen.getByText(/Hello!/)).toBeInTheDocument()
  })
})
