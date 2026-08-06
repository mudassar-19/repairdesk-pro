import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, SHARED_PROFILE_DIR, shoot } from '../fixtures/support'

const SUFFIX = Date.now().toString().slice(-7)
const SHOP_NAME = `E2E Repair Shop ${SUFFIX}`

test.describe.serial('Settings', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(SHARED_PROFILE_DIR))
    await window.locator('nav').getByRole('link', { name: /^Settings/ }).click()
    await expect(window.locator('main').getByText('Settings', { exact: true })).toBeVisible()
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('updates shop branding and shows the saved confirmation', async () => {
    const shopNameInput = window.getByLabel(/^Shop Name/)
    await shopNameInput.fill(SHOP_NAME)
    await shoot(window, '09-settings-branding-edited')
    await window.getByRole('button', { name: 'Save' }).first().click()

    await expect(window.getByText('Saved', { exact: true })).toBeVisible({ timeout: 5_000 })
    await shoot(window, '09-settings-branding-saved')
  })

  test('persists the branding change across a reload of the section', async () => {
    await window.locator('nav').getByRole('link', { name: /^Dashboard/ }).click()
    await window.locator('nav').getByRole('link', { name: /^Settings/ }).click()
    await expect(window.getByLabel(/^Shop Name/)).toHaveValue(SHOP_NAME, { timeout: 5_000 })
  })

  test('Google Drive: Connect button reaches the "waiting for sign-in" state', async () => {
    const connectButton = window.getByRole('button', { name: 'Connect Google Drive' })
    await expect(connectButton).toBeVisible()
    await connectButton.click()
    // Real OAuth (opens the system browser) is intentionally not completed here —
    // just confirming the click is wired up and the button reflects the pending state.
    await expect(window.getByText('Waiting for Google sign-in')).toBeVisible({ timeout: 5_000 })
    await shoot(window, '09-settings-google-drive-connecting')
  })

  test('creates a local backup and it appears in the list', async () => {
    await window.getByRole('button', { name: 'Backup Now' }).click()
    await expect(window.getByText('Backup created')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('Manual', { exact: true }).first()).toBeVisible()
    await shoot(window, '09-settings-backup-created')
  })

  test('Restore shows a clear confirmation before touching data', async () => {
    // Scope to a specific backup row's "Restore" button — the toolbar's
    // "Restore from File" button also matches "Restore" as a substring but
    // opens a real native file-picker dialog, which we must not trigger.
    const backupRow = window.locator('div.flex.items-center.justify-between.px-md.py-sm').first()
    await expect(backupRow).toContainText('Manual')
    await backupRow.getByRole('button', { name: 'Restore' }).click()
    await expect(window.getByText('Restore this backup?')).toBeVisible({ timeout: 5_000 })
    await shoot(window, '09-settings-restore-confirm')

    // Confirming would restore the DB and relaunch the whole Electron process
    // (see main/ipc/backup.ts's relaunchAfterRestore) — intentionally not
    // completed here, since that would tear down the app process this test
    // suite is driving. Cancel instead, which still proves the confirmation
    // gate is in place before any destructive action.
    await window.getByRole('button', { name: 'Cancel' }).click()
    await expect(window.getByText('Restore this backup?')).not.toBeVisible()
  })
})
