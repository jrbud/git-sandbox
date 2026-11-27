import { describe, expect, it } from 'vitest'
import { progressColor } from '../../src/theme/progressColor'
import { contrastRatio, THEMES, type ThemeName } from '../../src/theme/tokens'

/** Straight sRGB blend, close enough to the browser's oklab mix to check contrast. */
function mix(a: string, b: string, weightOfA: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2]
    .map((i) => Math.round(channel(a, i) * weightOfA + channel(b, i) * (1 - weightOfA)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`
}

describe('progressColor', () => {
  it('is the normal text colour at 0% and green at 100%', () => {
    expect(progressColor(0)).toBe('var(--color-text)')
    expect(progressColor(100)).toBe('var(--color-success)')
  })

  it('moves from yellow towards green in between', () => {
    expect(progressColor(25)).toBe(
      'color-mix(in oklab, var(--color-success) 25%, var(--color-progress))',
    )
    expect(progressColor(75)).toBe(
      'color-mix(in oklab, var(--color-success) 75%, var(--color-progress))',
    )
  })

  it.each(['dark', 'light'] as ThemeName[])(
    'stays readable (4.5:1) at every step in the %s theme',
    (name) => {
      const t = THEMES[name]
      for (const weight of [0, 0.25, 0.5, 0.75, 1]) {
        const color = mix(t.success, t.progress, weight)
        for (const background of [t.surface, t.surfaceAlt]) {
          expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5)
        }
      }
    },
  )
})
