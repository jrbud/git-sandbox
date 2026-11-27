import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { contrastRatio, cssVariable, THEMES, type ThemeName } from '../../src/theme/tokens'
import { ThemeProvider } from '../../src/theme/ThemeProvider'
import { ThemeToggle } from '../../src/theme/ThemeToggle'

const cssVar = (name: string) => document.documentElement.style.getPropertyValue(name)

beforeEach(() => {
  window.localStorage.clear()
})

// Phase 2 step 13: the light/dark theme system.
describe('theme toggle', () => {
  it('starts dark and applies the dark tokens as CSS variables', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(cssVar(cssVariable('bg'))).toBe(THEMES.dark.bg)
    expect(cssVar('--color-text-muted')).toBe(THEMES.dark.textMuted)
  })

  it('switches every token to the light theme and back, and remembers the choice', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    for (const [name, value] of Object.entries(THEMES.light)) {
      expect(cssVar(cssVariable(name as keyof typeof THEMES.light))).toBe(value)
    }
    expect(window.localStorage.getItem('git-quest:theme')).toBe('light')
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(cssVar(cssVariable('bg'))).toBe(THEMES.dark.bg)
  })
})

describe.each(['dark', 'light'] as ThemeName[])('%s theme contrast', (name) => {
  const t = THEMES[name]

  it.each([
    ['text', t.text],
    ['textMuted', t.textMuted],
    ['accent', t.accent],
    ['success', t.success],
    ['danger', t.danger],
  ])('%s text meets WCAG AA (4.5:1) on every background', (_, color) => {
    for (const background of [t.bg, t.surface, t.surfaceAlt]) {
      expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('button text on the accent colour meets 4.5:1', () => {
    expect(contrastRatio(t.accentText, t.accent)).toBeGreaterThanOrEqual(4.5)
  })

  it('graph lanes and the focus ring meet the 3:1 non-text contrast minimum', () => {
    for (const color of [t.lane0, t.lane1, t.lane2, t.lane3, t.lane4, t.lane5, t.focus]) {
      expect(contrastRatio(color, t.surface)).toBeGreaterThanOrEqual(3)
    }
  })
})
