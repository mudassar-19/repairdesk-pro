import type { ReactNode } from 'react'
import type { BilingualString } from '@shared/i18n'
import { BilingualText } from './BilingualText'
import { Button } from './Button'

export interface ConfirmDialogProps {
  open: boolean
  title: BilingualString
  body: BilingualString
  confirmLabel: BilingualString
  cancelLabel: BilingualString
  /** Red confirm button for destructive actions (delete). Default is the primary brand color. */
  danger?: boolean
  /** Extra dynamic content between body and buttons (e.g. a specific amount) — the static body text alone can't carry a runtime value. */
  children?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

/** Generic confirmation modal — every module's delete/destructive actions should use this, not window.confirm(). */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  children,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-lg"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-lg bg-surface p-xl shadow-raised"
        onClick={(event) => event.stopPropagation()}
      >
        <BilingualText text={title} as="div" size="lg" className="mb-sm" />
        <BilingualText text={body} as="div" size="sm" className={children ? 'mb-md text-ink-muted' : 'mb-lg text-ink-muted'} />
        {children && <div className="mb-lg">{children}</div>}
        <div className="flex justify-end gap-sm">
          <Button variant="ghost" onClick={onCancel}>
            <BilingualText text={cancelLabel} size="sm" align="center" />
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            <BilingualText text={confirmLabel} size="sm" align="center" />
          </Button>
        </div>
      </div>
    </div>
  )
}
