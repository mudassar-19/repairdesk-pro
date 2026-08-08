import { useEffect, useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { dictionary } from '@shared/i18n'
import { formatCurrency } from '@shared/lib/currency'
import { formatLocalDate } from '@shared/lib/dateRangePresets'
import { useBrandingSettings } from '@shared/hooks/useBrandingSettings'
import type { Repair } from '../../../../main/db/repositories/repairRepository'
import type { DeliverOnCreditResult } from '../../../../main/db/services/deliveryService'

const inputClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

const round2 = (n: number): number => Math.round(n * 100) / 100

export interface DeliverOnCreditModalProps {
  repair: Repair | null
  open: boolean
  onClose: () => void
  onDelivered: (result: DeliverOnCreditResult) => void
}

export function DeliverOnCreditModal({ repair, open, onClose, onDelivered }: DeliverOnCreditModalProps) {
  const { branding } = useBrandingSettings()
  const currency = branding?.currency ?? 'PKR'
  const remaining = repair?.remainingBalance ?? 0

  const [amount, setAmount] = useState('')
  const [locked, setLocked] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset whenever a different repair is opened.
  useEffect(() => {
    if (open) {
      setAmount('')
      setLocked(false)
      setDueDate('')
      setError(null)
    }
  }, [open, repair?.id])

  if (!open || !repair) return null

  const udhaarAmount = Math.min(Math.max(Number(amount) || 0, 0), remaining)
  const payingNow = round2(remaining - udhaarAmount)
  const valid = udhaarAmount > 0 && udhaarAmount <= remaining

  const setFull = () => {
    setAmount(String(remaining))
    setLocked(true)
    setError(null)
  }
  const setHalf = () => {
    setAmount(String(round2(remaining / 2)))
    setLocked(false)
    setError(null)
  }

  const handleConfirm = async () => {
    if (!valid) {
      setError('Enter a valid credit amount (up to the remaining balance).')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await window.api.repairs.deliverOnCredit({
        repairId: repair.id,
        udhaarAmount,
        dueDate: dueDate.trim() || null
      })
      onDelivered(result)
    } catch {
      setError('Could not deliver on credit. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-lg" onClick={handleClose}>
      <div className="w-full max-w-md rounded-lg bg-surface p-xl shadow-raised" onClick={(e) => e.stopPropagation()}>
        <BilingualText text={dictionary.repairs.deliverOnCreditTitle} as="div" size="lg" />
        <BilingualText text={dictionary.repairs.deliverOnCreditBody} size="sm" className="mt-1 text-ink-muted" />

        <div className="mt-lg mb-md flex items-center justify-between rounded-md bg-surface-raised p-md">
          <BilingualText text={dictionary.repairs.remainingBalance} size="sm" className="text-ink-muted" />
          <span className="text-lg font-medium text-ink">{formatCurrency(remaining, currency)}</span>
        </div>

        <div className="mb-md flex gap-sm">
          <Button type="button" variant="secondary" size="sm" onClick={setFull} className="flex-1">
            <BilingualText text={dictionary.repairs.quickFull} size="xs" align="center" />
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={setHalf} className="flex-1">
            <BilingualText text={dictionary.repairs.quickHalf} size="xs" align="center" />
          </Button>
        </div>

        <label className="mb-md flex flex-col gap-1">
          <BilingualText text={dictionary.repairs.onCreditAmount} size="sm" className="text-ink-muted" />
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            disabled={locked}
            autoFocus
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputClass} ${locked ? 'cursor-not-allowed opacity-60' : ''}`}
          />
        </label>

        <label className="mb-md flex flex-col gap-1">
          <BilingualText text={dictionary.udhaar.dueDateOptionalField} size="sm" className="text-ink-muted" />
          <input type="date" min={formatLocalDate(new Date())} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        </label>

        <div className="mb-lg grid grid-cols-2 gap-md rounded-md border border-border/60 p-md">
          <div>
            <BilingualText text={dictionary.repairs.payingNow} size="xs" className="text-ink-muted" />
            <p className="mt-0.5 text-base font-medium text-success">{formatCurrency(payingNow, currency)}</p>
          </div>
          <div>
            <BilingualText text={dictionary.repairs.onCreditLabel} size="xs" className="text-ink-muted" />
            <p className="mt-0.5 text-base font-medium text-warning">{formatCurrency(udhaarAmount, currency)}</p>
          </div>
        </div>

        {error && <p role="alert" className="mb-md rounded-md bg-danger/10 px-sm py-sm text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-sm">
          <Button type="button" variant="ghost" onClick={handleClose}>
            <BilingualText text={dictionary.udhaar.cancel} size="sm" align="center" />
          </Button>
          <Button type="button" variant="primary" onClick={handleConfirm} disabled={saving || !valid}>
            <BilingualText text={dictionary.repairs.confirmDeliver} size="sm" align="center" />
          </Button>
        </div>
      </div>
    </div>
  )
}
