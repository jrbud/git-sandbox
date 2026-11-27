import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext } from './themeContext'
import { cssVariable, THEMES, TOKEN_NAMES, type ThemeName } from './tokens'

const STORAGE_KEY = 'git-quest:theme'

function initialTheme(fallback: ThemeName): ThemeName {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    // Storage can be unavailable (private mode); the default theme is fine.
  }
  return fallback
}

/** Applies the theme's colour tokens as CSS variables on <html>. Dark is the default. */
export function ThemeProvider({
  children,
  defaultTheme = 'dark',
}: {
  children: ReactNode
  defaultTheme?: ThemeName
}) {
  const [theme, setThemeState] = useState<ThemeName>(() => initialTheme(defaultTheme))

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.colorScheme = theme
    for (const name of TOKEN_NAMES) root.style.setProperty(cssVariable(name), THEMES[theme][name])
  }, [theme])

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not being able to remember the choice is harmless.
    }
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark') }),
    [theme, setTheme],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
