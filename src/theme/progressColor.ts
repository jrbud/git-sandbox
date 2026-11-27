/**
 * Colour for a completion percentage: the normal text colour at 0%, then a blend that moves
 * from yellow (just started) to green (100%). The number itself is always shown too, so the
 * colour is never the only cue.
 */
export function progressColor(percent: number): string {
  if (percent <= 0) return 'var(--color-text)'
  if (percent >= 100) return 'var(--color-success)'
  const green = Math.round(percent)
  return `color-mix(in oklab, var(--color-success) ${green}%, var(--color-progress))`
}
