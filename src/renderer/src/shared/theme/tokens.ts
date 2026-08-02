/**
 * Typed access to the CSS variables declared in theme.css, for the rare case
 * where a value is needed outside a Tailwind class string (inline styles,
 * canvas/print contexts, third-party components). Component code should
 * prefer Tailwind utility classes (bg-primary, text-ink, ...) over this.
 *
 * Values themselves live only in theme.css — this file never hardcodes them.
 */

const cssVar = (name: string) => `var(${name})`

export const colors = {
  bg: cssVar('--color-bg'),
  surface: cssVar('--color-surface'),
  surfaceRaised: cssVar('--color-surface-raised'),
  border: cssVar('--color-border'),
  ink: cssVar('--color-ink'),
  inkMuted: cssVar('--color-ink-muted'),
  primary: cssVar('--color-primary'),
  primaryHover: cssVar('--color-primary-hover'),
  primaryTint: cssVar('--color-primary-tint'),
  primaryInk: cssVar('--color-primary-ink'),
  success: cssVar('--color-success'),
  warning: cssVar('--color-warning'),
  danger: cssVar('--color-danger')
} as const

export const spacing = {
  xs: cssVar('--space-xs'),
  sm: cssVar('--space-sm'),
  md: cssVar('--space-md'),
  lg: cssVar('--space-lg'),
  xl: cssVar('--space-xl'),
  '2xl': cssVar('--space-2xl')
} as const

export const radius = {
  sm: cssVar('--radius-sm'),
  md: cssVar('--radius-md'),
  lg: cssVar('--radius-lg')
} as const

export const typography = {
  fontSans: cssVar('--font-sans'),
  fontUrdu: cssVar('--font-urdu'),
  textXs: cssVar('--text-xs'),
  textSm: cssVar('--text-sm'),
  textBase: cssVar('--text-base'),
  textLg: cssVar('--text-lg'),
  textXl: cssVar('--text-xl'),
  text2xl: cssVar('--text-2xl')
} as const

export const theme = { colors, spacing, radius, typography } as const

export type Theme = typeof theme
