/**
 * Resolves the app's theme CSS variables to real computed color values
 * (e.g. "#0d9488") for use as Recharts stroke/fill props. Recharts applies
 * colors in ways that don't reliably resolve var(--...) references the same
 * way a plain CSS class does, so this reads the actual value once via
 * getComputedStyle rather than passing raw var() strings into the chart —
 * the same "rare case outside a Tailwind class string" shared/theme/tokens.ts
 * already exists for, just resolved rather than left as a var() reference.
 * The app has no dark-mode toggle, so these never need to be reactive.
 */
export interface ChartColors {
  primary: string
  primaryLight: string
  success: string
  warning: string
  danger: string
  inkMuted: string
  border: string
  /** For multi-series breakdowns (Brand Statistics) — built only from tones already in the palette, never new hues. */
  categorical: string[]
}

function resolveVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

let cached: ChartColors | null = null

export function getChartColors(): ChartColors {
  if (cached) return cached
  const primary = resolveVar('--color-primary-600')
  const primaryLight = resolveVar('--color-primary-500')
  const success = resolveVar('--color-success')
  const warning = resolveVar('--color-warning')
  const danger = resolveVar('--color-danger')
  const inkMuted = resolveVar('--color-ink-muted')

  cached = {
    primary,
    primaryLight,
    success,
    warning,
    danger,
    inkMuted,
    border: resolveVar('--color-border'),
    categorical: [
      primary,
      success,
      warning,
      danger,
      primaryLight,
      resolveVar('--color-primary-700'),
      inkMuted,
      resolveVar('--color-gray-400')
    ]
  }
  return cached
}
