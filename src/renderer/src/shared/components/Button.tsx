import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost' | 'warning'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

/**
 * The one place the primary/secondary/ghost/danger hierarchy is defined —
 * every screen should reach for this instead of inventing its own
 * bg-x/10-tint button, so "this is the main action" reads the same
 * everywhere. variant carries meaning: primary = forward-progress action,
 * secondary = reversible/undo, ghost = low-emphasis, danger = destructive
 * (kept out of ActionMenu-less places entirely where possible — see
 * ActionMenu for actions that should never sit flush next to a primary
 * button).
 */
const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-ink shadow-card hover:bg-primary-hover',
  secondary: 'border border-border text-ink hover:bg-surface-raised',
  ghost: 'text-ink-muted hover:bg-surface-raised hover:text-ink',
  danger: 'bg-danger text-white shadow-card hover:bg-danger/90',
  'danger-ghost': 'text-danger hover:bg-danger/10',
  // For a deliberate, occasional "proceed with caution" action (e.g.
  // recording an overpayment) — distinct from danger, which is reserved for
  // actions that destroy/remove something.
  warning: 'bg-warning text-white shadow-card hover:bg-warning/90'
}

/**
 * Vertical padding is deliberately roomier than a single-line button would
 * need — most buttons here render two-line bilingual content
 * (BilingualText), and py-1/py-xs on their own left the Urdu line looking
 * squeezed against the button edge.
 */
const sizeClass: Record<ButtonSize, string> = {
  sm: 'gap-1 px-sm py-xs',
  md: 'gap-1.5 px-md py-sm'
}

export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
