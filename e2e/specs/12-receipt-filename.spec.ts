import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, authenticateOffline, shoot } from '../fixtures/support'

/**
 * Part G — receipt PDF filename. Drives the real ReceiptModal UI and clicks
 * Export PDF; the native Save dialog is intercepted in the MAIN process so the
 * real print:exportPdf IPC runs end-to-end and we can capture the suggested
 * filename it proposes.
 */

const SUFFIX = Date.now().toString().slice(-6)

test.describe.serial('Receipt PDF filename (Part G)', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('receipt-filename')))
    await authenticateOffline(window)
    await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 20_000 })
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('exports as {Customer}_{Device}_{shortCode}.pdf', async () => {
    // Create a repair for a known customer/device.
    await window.locator('nav').getByRole('link', { name: /^Repairs/ }).click()
    await window.getByRole('button', { name: 'New Repair Order' }).click()
    const picker = window.locator('form').locator('input[type=text]').first()
    await picker.fill(`Zubair Khan ${SUFFIX}`)
    await window.getByText('Create New Customer', { exact: false }).click()
    await window.locator('input[type=tel]').first().fill(`03000${SUFFIX}`)
    await window.getByRole('button', { name: 'Save' }).first().click()
    await expect(window.getByText(`Zubair Khan ${SUFFIX}`)).toBeVisible({ timeout: 5_000 })

    await window.getByLabel(/Device Brand/).fill('Samsung')
    await window.getByLabel(/Device Model/).fill('Galaxy A50')
    await window.locator('textarea').first().fill('E2E receipt')
    await window.getByLabel(/Total Price/).fill('3000')
    await window.getByRole('button', { name: 'Save' }).click()
    await expect(window.getByText('Samsung Galaxy A50')).toBeVisible({ timeout: 10_000 })

    // Intercept the native Save dialog in the main process to capture defaultPath.
    await app.evaluate(({ dialog }) => {
      const g = globalThis as unknown as { __savePath?: string | undefined }
      dialog.showSaveDialog = (async (opts: { defaultPath?: string }) => {
        g.__savePath = opts?.defaultPath
        return { canceled: true, filePath: undefined }
      }) as typeof dialog.showSaveDialog
    })

    await window.getByRole('button', { name: /Print Receipt/ }).click()
    await expect(window.getByText(/Receipt/i).first()).toBeVisible()
    await shoot(window, '12-receipt-modal')
    await window.getByRole('button', { name: /Export PDF/ }).click()

    // Wait until the intercepted dialog captured a suggested filename.
    await expect
      .poll(async () => app.evaluate(() => (globalThis as unknown as { __savePath?: string }).__savePath), {
        timeout: 10_000
      })
      .toBeTruthy()

    const captured = (await app.evaluate(() => (globalThis as unknown as { __savePath?: string }).__savePath)) ?? ''
    const base = captured.split(/[/\\]/).pop() ?? captured
    expect(base).toMatch(/^Zubair_Khan_[0-9]+_Samsung_Galaxy_A50_[A-Z0-9]{6}\.pdf$/)
  })
})
