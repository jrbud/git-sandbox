import { createContext, useContext } from 'react'
import type { ThemeName } from './tokens'

export interface ThemeContextValue {
  theme: ThemeName
  setTheme(theme: ThemeName): void
  toggleTheme(): void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}
