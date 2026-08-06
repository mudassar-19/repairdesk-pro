/**
 * Derives a small Tailwind-style tint/shade scale from the single brand color
 * a shop owner picks (theme.css's public API is --color-primary/-hover/-tint/
 * -ink, backed by --color-primary-50/100/500/600/700 — see tailwind.config.js).
 * Applied via inline styles on the root element, which override theme.css's
 * :root rule for the same custom properties — Tailwind utility classes read
 * the CSS variable at paint time, not at build time, so this takes effect
 * immediately with no app restart and no React re-render required.
 */

function hexToHsl(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  const r = parseInt(normalized.slice(0, 2), 16) / 255
  const g = parseInt(normalized.slice(2, 4), 16) / 255
  const b = parseInt(normalized.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return [0, 0, l * 100]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      break
    case g:
      h = ((b - r) / d + 2) / 6
      break
    default:
      h = ((r - g) / d + 4) / 6
  }
  return [h * 360, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = Math.max(0, Math.min(100, s)) / 100
  const lNorm = Math.max(0, Math.min(100, l)) / 100
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lNorm - c / 2

  let [r, g, b] = [0, 0, 0]
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export interface BrandPalette {
  50: string
  100: string
  500: string
  600: string
  700: string
  /** Text color to place on top of the primary color — white, unless the chosen color is light enough that white would fail contrast. */
  ink: string
}

export function deriveBrandPalette(baseHex: string): BrandPalette {
  const [h, s, l] = hexToHsl(baseHex)
  return {
    50: hslToHex(h, Math.max(s - 30, 10), Math.min(l + 42, 97)),
    100: hslToHex(h, Math.max(s - 20, 15), Math.min(l + 34, 93)),
    500: hslToHex(h, s, Math.min(l + 8, 92)),
    600: baseHex,
    700: hslToHex(h, s, Math.max(l - 10, 8)),
    ink: l > 65 ? '#0f172a' : '#ffffff'
  }
}

/** Overrides theme.css's --color-primary-* variables live on the root element. */
export function applyBrandColor(baseHex: string): void {
  const palette = deriveBrandPalette(baseHex)
  const root = document.documentElement.style
  root.setProperty('--color-primary-50', palette[50])
  root.setProperty('--color-primary-100', palette[100])
  root.setProperty('--color-primary-500', palette[500])
  root.setProperty('--color-primary-600', palette[600])
  root.setProperty('--color-primary-700', palette[700])
  root.setProperty('--color-primary', palette[600])
  root.setProperty('--color-primary-hover', palette[700])
  root.setProperty('--color-primary-tint', palette[50])
  root.setProperty('--color-primary-ink', palette.ink)
}
