import { ipcMain, dialog } from 'electron'
import fs from 'node:fs/promises'

export interface ExportPdfResult {
  success: boolean
  filePath?: string
}

type NamedPageSize = 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'Legal' | 'Letter' | 'Tabloid' | 'Ledger'
export type PdfPageSize = NamedPageSize | { width: number; height: number }

/**
 * 80mm ≈ 3.15in — the more common of the two standard thermal receipt
 * widths (58mm/80mm). Height is a generous fixed 14in rather than an exact
 * fit, since printToPDF needs a page size up front and can't know the
 * rendered receipt's real height in advance; a short receipt just leaves
 * trailing whitespace on the PDF page rather than getting cut off.
 * printToPDF's custom Size is documented in inches — print()'s is not
 * clearly documented, so print:direct deliberately leaves pageSize
 * unspecified and lets the user pick their real paper width in the native
 * dialog, rather than risk silently wrong units.
 */
export const RECEIPT_PDF_PAGE_SIZE: PdfPageSize = { width: 3.15, height: 14 }

/**
 * Shared print/export plumbing — not report-specific. Whatever the
 * currently-focused renderer is showing (its @media print rules decide what
 * that is; see AppLayout's no-print class) gets rasterized exactly as
 * rendered. Phase 11 receipts reuse these same two channels with a new
 * print-styled component and a receipt-sized pageSize, not a new mechanism.
 */
/**
 * printToPDF()/print() capture whatever is currently painted, but don't wait
 * for in-flight @font-face loads first — theme.css's Noto Nastaliq Urdu uses
 * font-display: swap, so it's loaded asynchronously and Chromium's print
 * pipeline can run its own layout/shaping pass before that load (and the
 * Arabic-script shaping it enables) has actually finished, even though the
 * on-screen paint the user sees a moment later looks correct. This showed up
 * as garbled/jumbled Urdu text only in exported PDFs, never on screen.
 * Explicitly awaiting document.fonts.ready in the target renderer closes
 * that race before either print path runs.
 */
async function waitForFontsReady(event: Electron.IpcMainInvokeEvent): Promise<void> {
  await event.sender.executeJavaScript('document.fonts.ready.then(() => true)')
}

export function registerPrintIpc(): void {
  ipcMain.handle(
    'print:exportPdf',
    async (
      event,
      suggestedFileName: string,
      pageSize?: PdfPageSize,
      marginType?: 'default' | 'none'
    ): Promise<ExportPdfResult> => {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Export as PDF',
        defaultPath: suggestedFileName,
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
      })
      if (canceled || !filePath) return { success: false }

      await waitForFontsReady(event)
      // marginType defaults to Chromium's own 'default' when omitted
      // (Reports' A4 page) — verified 'default' and 'none' render
      // identically for a custom pageSize like the receipt's, so this
      // isn't masking a real margin problem. It's set explicitly for the
      // receipt anyway: it's the more honest/correct setting (this app's
      // own CSS padding is the only spacing that should apply), and it
      // costs nothing since it's a no-op either way in this Electron
      // version.
      const buffer = await event.sender.printToPDF({
        printBackground: true,
        pageSize: pageSize ?? 'A4',
        margins: { marginType: marginType ?? 'default' }
      })
      await fs.writeFile(filePath, buffer)
      return { success: true, filePath }
    }
  )

  ipcMain.handle('print:direct', async (event): Promise<boolean> => {
    await waitForFontsReady(event)
    return new Promise((resolve) => {
      event.sender.print({ silent: false, printBackground: true }, (success) => resolve(success))
    })
  })
}
