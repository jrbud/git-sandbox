export type ThemeName = 'dark' | 'light'

export const TOKEN_NAMES = [
  'bg',
  'surface',
  'surfaceAlt',
  'border',
  'text',
  'textMuted',
  'accent',
  'accentText',
  'success',
  'danger',
  'focus',
  'lane0',
  'lane1',
  'lane2',
  'lane3',
  'lane4',
  'lane5',
] as const

export type TokenName = (typeof TOKEN_NAMES)[number]
export type ThemeTokens = Record<TokenName, string>

/**
 * Colour tokens for both themes. Graph lanes use the Okabe-Ito colour-blind-safe palette, and
 * every indicator also has a non-colour cue (dash pattern, icon or label).
 */
export const THEMES: Record<ThemeName, ThemeTokens> = {
  dark: {
    bg: '#0f1115',
    surface: '#171a21',
    surfaceAlt: '#1f232c',
    border: '#353c4a',
    text: '#e6e8eb',
    textMuted: '#a7afbc',
    accent: '#7cc4ff',
    accentText: '#0f1115',
    success: '#6fd08c',
    danger: '#ff8b82',
    focus: '#ffd166',
    lane0: '#56b4e9',
    lane1: '#e69f00',
    lane2: '#2fbf8f',
    lane3: '#cc79a7',
    lane4: '#f0e442',
    lane5: '#ff8c42',
  },
  light: {
    bg: '#fafaf9',
    surface: '#ffffff',
    surfaceAlt: '#f0f1f3',
    border: '#c9ced6',
    text: '#1b1f24',
    textMuted: '#535b66',
    accent: '#0b5cb8',
    accentText: '#ffffff',
    success: '#1b6e35',
    danger: '#b3261e',
    focus: '#a34f00',
    lane0: '#0072b2',
    lane1: '#b35900',
    lane2: '#007a5a',
    lane3: '#a8457f',
    lane4: '#7a6a00',
    lane5: '#4d4d4d',
  },
}

export function cssVariable(name: TokenName): string {
  return `--color-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2 contrast ratio between two colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}
