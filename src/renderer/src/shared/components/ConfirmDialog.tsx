import type { BilingualString } from '@shared/i18n'
import { BilingualText } from './BilingualText'

export interface ConfirmDialogProps {
  open: boolean
  title: BilingualString
  body: BilingualString
  confirmLabel: BilingualString
  cancelLabel: BilingualString
  /** Red confirm button for destructive actions (delete). Default is the primary brand color. */
  danger?: boolean
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
        <BilingualText text={body} as="div" size="sm" className="mb-lg text-ink-muted" />
        <div className="flex justify-end gap-sm">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-md py-sm text-sm font-medium text-ink-muted transition-colors hover:bg-surface-raised"
          >
            <BilingualText text={cancelLabel} size="sm" className="items-center" />
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-md py-sm text-sm font-medium text-white transition-colors ${
              danger ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary-hover'
            }`}
          >
            <BilingualText text={confirmLabel} size="sm" className="items-center" />
          </button>
        </div>
      </div>
    </div>
  )
}
