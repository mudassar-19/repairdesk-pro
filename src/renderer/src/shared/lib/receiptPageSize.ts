/**
 * Mirrors main/ipc/print.ts's RECEIPT_PDF_PAGE_SIZE — duplicated, not
 * imported, because that file also imports 'electron' and 'node:fs/promises'
 * (main-process-only modules) which can't be bundled into the renderer.
 * Same reasoning as repairStatus.ts/paymentType.ts/expenseCategory.ts
 * duplicating their small value arrays instead of importing schema.ts.
 * 80mm ≈ 3.15in — the more common of the two standard thermal receipt
 * widths (58mm/80mm); height is a generous fixed value since printToPDF
 * needs a page size up front and can't know the rendered content's real
 * height in advance.
 */
export const RECEIPT_PDF_PAGE_SIZE = { width: 3.15, height: 14 }
