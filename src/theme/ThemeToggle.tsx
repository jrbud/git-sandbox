import { useTheme } from './themeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="toolbar-button"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
    >
      {next === 'light' ? 'Light' : 'Dark'} theme
    </button>
  )
}
