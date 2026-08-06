import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { BilingualText } from './BilingualText'
import { MoreVerticalIcon } from './icons'
import type { BilingualString } from '@shared/i18n'

export interface ActionMenuItem {
  label: BilingualString
  onClick: () => void
  danger?: boolean
}

export interface ActionMenuProps {
  items: ActionMenuItem[]
  /** List rows wrap this in their own onClick-to-navigate handler — stops the trigger click from also firing that. */
  stopRowClick?: boolean
}

/**
 * Compact "more actions" trigger for less-common/destructive actions (e.g.
 * Cancel Order) that shouldn't sit inline next to a primary button where a
 * misclick could trigger them. Menu content is rendered via a portal at a
 * measured position (position: fixed — the one deliberate inline-style
 * exception in this codebase, unavoidable since the coordinates are only
 * known at click time) so it is never clipped by an ancestor's
 * overflow-hidden, e.g. the Repairs table's rounded card wrapper.
 */
export function ActionMenu({ items, stopRowClick = false }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, right: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    // A scrolled/resized ancestor would leave the menu pointing at stale
    // coordinates — closing is simpler and safer than tracking every
    // possible scroll container's position.
    const handleDismiss = () => setOpen(false)

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleDismiss, true)
    window.addEventListener('resize', handleDismiss)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleDismiss, true)
      window.removeEventListener('resize', handleDismiss)
    }
  }, [open])

  const toggleOpen = (event: ReactMouseEvent) => {
    if (stopRowClick) event.stopPropagation()
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen((current) => !current)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
      >
        <MoreVerticalIcon width={18} height={18} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: coords.top, right: coords.right }}
            className="z-50 w-48 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-raised"
          >
            {items.map((item, index) => (
              <button
                key={index}
                type="button"
                role="menuitem"
                onClick={(event) => {
                  // A menu item click is a deliberate, already-committed
                  // action from an explicitly opened menu — it must never
                  // also trigger whatever the row/card underneath does.
                  event.stopPropagation()
                  setOpen(false)
                  item.onClick()
                }}
                className={`flex w-full items-center px-md py-sm text-left transition-colors hover:bg-surface-raised ${
                  item.danger ? 'text-danger' : 'text-ink'
                }`}
              >
                <BilingualText text={item.label} size="xs" />
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
