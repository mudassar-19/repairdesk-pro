import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
}

const paddingClass: Record<Required<CardProps>['padding'], string> = {
  none: '',
  sm: 'p-sm',
  md: 'p-md',
  lg: 'p-lg',
  xl: 'p-xl'
}

/**
 * The one card/panel treatment for the whole app — border, radius, and
 * shadow in one place instead of every screen repeating
 * `rounded-lg border border-border/60 bg-surface shadow-card` by hand
 * (19 places did, before this). Use padding="none" when the content manages
 * its own internal padding (e.g. a CardHeader + list of rows, or a table).
 */
export function Card({ padding = 'lg', className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-border/60 bg-surface shadow-card ${paddingClass[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

/** The title + trailing action row every list-style card uses above a divider. Pair with Card padding="none". */
export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-md border-b border-border px-lg py-md ${className}`}>
      {children}
    </div>
  )
}
