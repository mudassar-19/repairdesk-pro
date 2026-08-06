import { useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { PrintBrandingHeader } from '@shared/components/PrintBrandingHeader'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { RECEIPT_PDF_PAGE_SIZE } from '@shared/lib/receiptPageSize'
import { useBrandingSettings } from '@shared/hooks/useBrandingSettings'
import { useReceiptSettings } from '@shared/hooks/useReceiptSettings'
import { formatCurrency } from '@shared/lib/currency'
import type { Repair } from '../../../../main/db/repositories/repairRepository'
import type { Customer } from '../../../../main/db/repositories/customerRepository'

export interface ReceiptModalProps {
  repair: Repair
  customer: Customer | null
  open: boolean
  onClose: () => void
}

/**
 * Preview IS what prints — there is no separate render path for "what you
 * see" vs "what gets printed/exported," same as Phase 9's Reports. Only the
 * receipt content below (not this file's toolbar/backdrop, marked no-print
 * and print-modal-overlay/content) ends up in the PDF or printed page.
 *
 * Deliberately never references repair.costPrice anywhere — cost is
 * internal-only data and must never reach a customer-facing receipt.
 */
export function ReceiptModal({ repair, customer, open, onClose }: ReceiptModalProps) {
  const [exporting, setExporting] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { branding, logoDataUrl } = useBrandingSettings()
  const { receiptSettings } = useReceiptSettings()

  if (!open) return null

  const currency = branding?.currency ?? 'PKR'
  const amountPaid = repair.repairPrice - repair.remainingBalance
  const receiptNo = repair.id.slice(0, 8).toUpperCase()
  const issuedDate = new Date().toLocaleDateString()

  const handlePrint = async () => {
    setPrinting(true)
    setMessage(null)
    const success = await window.api.print.direct()
    setPrinting(false)
    if (success) {
      setMessage(dictionary.receipts.printedConfirmation.en)
      logActivity({
        actionType: 'receipt_printed',
        entityType: 'repair',
        entityId: repair.id,
        description: `Receipt printed for repair ${receiptNo}`
      })
    }
  }

  const handleExportPdf = async () => {
    setExporting(true)
    setMessage(null)
    const fileName = `Receipt-${receiptNo}.pdf`
    // 'none' — this app's own CSS padding is the only spacing that should
    // apply on an already-narrow 3.15in page; see print.ts's exportPdf handler.
    const result = await window.api.print.exportPdf(fileName, RECEIPT_PDF_PAGE_SIZE, 'none')
    setExporting(false)
    if (result.success) {
      setMessage(`Saved to ${result.filePath}`)
      logActivity({
        actionType: 'receipt_exported',
        entityType: 'repair',
        entityId: repair.id,
        description: `Receipt saved as PDF for repair ${receiptNo}`
      })
    }
  }

  return (
    <div
      className="print-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-sm"
      onClick={onClose}
    >
      <div
        className="print-modal-content flex max-h-[90vh] w-full max-w-[300px] flex-col overflow-hidden border border-border bg-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="no-print flex items-center justify-between border-b border-border px-md py-sm">
          <BilingualText text={dictionary.receipts.preview} as="div" size="lg" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            <BilingualText text={dictionary.receipts.close} size="xs" align="center" />
          </Button>
        </div>

        {/*
          p-xs is an on-screen preview convenience (so the card doesn't look
          glued to its own border) — receipt-scroll-area's print rule
          (theme.css) zeroes it out entirely for the actual export, along
          with print-modal-content's border, so the printed/exported
          receipt is just the receipt: no preview framing, full page width.
        */}
        <div className="receipt-scroll-area overflow-y-auto p-xs">
          <div className="w-full text-ink">
            <PrintBrandingHeader
              shopName={branding?.shopName}
              logoUrl={logoDataUrl}
              phone={branding?.phone}
              address={branding?.address}
              compact
            />

            {receiptSettings?.headerText.trim() && (
              <div className="mb-sm text-center text-xs text-ink-muted">{receiptSettings.headerText}</div>
            )}

            <div className="mb-sm text-center">
              <BilingualText text={dictionary.receipts.title} as="div" size="base" className="items-center" />
            </div>

            <div className="mb-sm flex justify-between text-xs text-ink-muted">
              <span>
                {dictionary.receipts.receiptNo.en}: {receiptNo}
              </span>
              <span>
                {dictionary.receipts.date.en}: {issuedDate}
              </span>
            </div>

            <div className="mb-sm border-t border-border pt-sm">
              <BilingualText text={dictionary.repairs.customer} size="sm" className="text-ink-muted" />
              <p className="text-sm font-medium text-ink">{customer?.name ?? '—'}</p>
              <p className="text-xs text-ink-muted">{customer?.phone}</p>
            </div>

            <div className="mb-sm">
              <BilingualText text={dictionary.receipts.device} size="sm" className="text-ink-muted" />
              <p className="text-sm text-ink">
                {repair.deviceBrand} {repair.deviceModel}
              </p>
              <p className="mt-1 text-sm text-ink">{repair.issue}</p>
              {repair.imei && (
                <p className="mt-1 text-xs text-ink-muted">
                  {dictionary.repairs.imei.en}: {repair.imei}
                </p>
              )}
            </div>

            {/* cost price is intentionally never shown here — customer receipts only ever show repair price, amount paid, and remaining balance. */}
            {/*
              Label above, amount right-aligned below — not side by side.
              At this receipt's narrow width, a bilingual (English + Urdu)
              label sitting next to a currency value in one row had nowhere
              safe to put the overflow: shrinking wrapped the value itself
              onto a second line mid-string ("PKR" / "3000.00"), and
              preventing that wrap just pushed the value off the page edge
              instead. Stacking removes the contest entirely — each line
              gets the full content width, so nothing wraps or clips
              regardless of currency symbol or amount length.
            */}
            <div className="mb-sm flex flex-col gap-1 border-t border-border pt-sm text-sm">
              <div>
                <BilingualText text={dictionary.repairs.repairPrice} size="sm" className="text-ink-muted" />
                <p className="text-right font-medium text-ink">{formatCurrency(repair.repairPrice, currency)}</p>
              </div>
              <div>
                <BilingualText text={dictionary.receipts.amountPaid} size="sm" className="text-ink-muted" />
                <p className="text-right font-medium text-ink">{formatCurrency(amountPaid, currency)}</p>
              </div>
              <div className="border-t border-border pt-1">
                <BilingualText text={dictionary.repairs.remainingBalance} size="sm" className="text-ink-muted" />
                <p className="text-right font-medium text-ink">{formatCurrency(repair.remainingBalance, currency)}</p>
              </div>
            </div>

            {repair.estimatedDeliveryDate && (
              <div className="mb-sm text-sm">
                <BilingualText
                  text={dictionary.repairs.estimatedDeliveryDate}
                  size="sm"
                  className="text-ink-muted"
                />
                <p className="text-ink">{repair.estimatedDeliveryDate}</p>
              </div>
            )}

            {/* Future QR Placeholder — reserved space only, no generation yet. Plain text, no box: a bordered/dashed block read as decoration on an otherwise flat receipt. */}
            <p className="mb-sm text-center text-xs text-ink-muted opacity-70">{dictionary.receipts.qrComingSoon.en}</p>

            <div className="border-t border-border pt-sm text-center">
              {receiptSettings?.footerText.trim() ? (
                <p className="text-sm text-ink-muted">{receiptSettings.footerText}</p>
              ) : (
                <BilingualText text={dictionary.receipts.thankYou} size="sm" className="items-center text-ink-muted" />
              )}
            </div>
          </div>
        </div>

        <div className="no-print flex items-center justify-between gap-sm border-t border-border px-md py-sm">
          <span className="text-xs text-success">{message}</span>
          <div className="flex gap-sm">
            <Button variant="secondary" size="sm" onClick={handleExportPdf} disabled={exporting}>
              <BilingualText text={dictionary.reports.exportPdf} size="xs" align="center" />
            </Button>
            <Button variant="primary" size="sm" onClick={handlePrint} disabled={printing}>
              <BilingualText text={dictionary.reports.print} size="xs" align="center" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
