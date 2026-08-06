import type { ReactNode } from 'react'

export type ScrollListMaxHeight = 'sm' | 'md' | 'lg'

/** sm/md/lg cover the three list shapes in the app today — a short daily-ops list, a default card list, and a taller detail list. Add a size here rather than reaching for an arbitrary className at the call site. */
const maxHeightClass: Record<ScrollListMaxHeight, string> = {
  sm: 'max-h-64',
  md: 'max-h-[26rem]',
  lg: 'max-h-[32rem]'
}

/**
 * Wraps a card section's list content (Recent Repairs, Recent Activity,
 * Today's Deliveries, ...) so the list scrolls internally once it grows
 * past a sensible height, instead of pushing the whole page taller. The
 * card's own header (title, count, "View all") stays outside this
 * component and never scrolls.
 */
export function ScrollList({
  children,
  maxHeight = 'md',
  className = ''
}: {
  children: ReactNode
  maxHeight?: ScrollListMaxHeight
  className?: string
}) {
  return <div className={`overflow-y-auto ${maxHeightClass[maxHeight]} ${className}`}>{children}</div>
}
