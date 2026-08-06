import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, SHARED_PROFILE_DIR, shoot } from '../fixtures/support'

/**
 * Export PDF / Print both go through Electron's native dialog.showSaveDialog
 * / webContents.print — real OS-level dialogs outside the Chromium page, not
 * part of the DOM. electronApp.evaluate() (the normal way to stub main-process
 * APIs in a Playwright/Electron test) is unreliable in this environment — it
 * fails ("Resulting promise was garbage collected") even for a trivial no-op
 * call, confirmed via a standalone repro before writing this file. Actually
 * clicking these buttons would pop a real, non-dismissable macOS dialog on
 * screen with nothing able to close it. So — same judgment call as the
 * Google Drive OAuth flow — this verifies the buttons reach the correct
 * enabled state (proving the report/receipt data loaded and wired up
 * correctly) without completing the native dialog itself.
 */
test.describe.serial('Reports & receipts', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(SHARED_PROFILE_DIR))
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('generates a monthly report with real seeded data', async () => {
    await window.locator('nav').getByRole('link', { name: /^Reports/ }).click()
    await expect(window.locator('main').getByText('Reports', { exact: true })).toBeVisible()
    await expect(window.getByText('Total Revenue')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('Expenses by Category')).toBeVisible()
    await shoot(window, '07-reports-monthly')

    await expect(window.getByRole('button', { name: 'Print' })).toBeEnabled()
    await expect(window.getByRole('button', { name: 'Export PDF' })).toBeEnabled()
  })

  test('switches between report periods without error', async () => {
    for (const label of ['Daily', 'Weekly', 'Yearly']) {
      await window.locator('select').first().selectOption({ label })
      await expect(window.getByText('Total Revenue')).toBeVisible({ timeout: 10_000 })
    }
    await window.locator('select').first().selectOption({ label: 'Custom' })
    await expect(window.getByText('Select a custom date range')).toBeVisible()
    // No report yet for an empty custom range — export/print correctly disabled.
    await expect(window.getByRole('button', { name: 'Export PDF' })).toBeDisabled()

    await window.locator('input[type=date]').first().fill('2026-08-01')
    await window.locator('input[type=date]').nth(1).fill('2026-08-06')
    await expect(window.getByText('Total Revenue')).toBeVisible({ timeout: 10_000 })
    await shoot(window, '07-reports-custom-range')

    await window.locator('select').first().selectOption({ label: 'Monthly' })
    await expect(window.getByText('Total Revenue')).toBeVisible({ timeout: 10_000 })
  })

  test('opens the receipt modal for a repair with export/print actions ready', async () => {
    await window.locator('nav').getByRole('link', { name: /^Repairs/ }).click()
    await window.locator('tbody tr').first().click()
    await expect(window.getByRole('button', { name: 'Print Receipt' })).toBeVisible()

    await window.getByRole('button', { name: 'Print Receipt' }).click()
    await expect(window.getByRole('button', { name: 'Export PDF' })).toBeVisible({ timeout: 5_000 })
    await expect(window.getByRole('button', { name: 'Export PDF' })).toBeEnabled()
    await expect(window.getByRole('button', { name: 'Print' }).last()).toBeEnabled()
    await shoot(window, '07-receipt-modal')
  })
})
