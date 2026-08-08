import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, authenticateOffline, shoot } from '../fixtures/support'

/**
 * Part F — backup simplification. Verifiable without real Google Drive:
 *  - the default daily cloud-backup times are 1 PM / 6 PM / 8 PM, shown as
 *    editable chips in Settings (real UI);
 *  - the fresh-device "existing backup?" check degrades cleanly when Drive
 *    isn't connected (real IPC).
 * The connected-account restore PROMPT itself needs live OAuth, so it's
 * covered by build/typecheck + code — same limitation as the existing
 * 09-settings Drive coverage.
 */

test.describe.serial('Backup settings (Part F)', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('backup')))
    await authenticateOffline(window)
    await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 20_000 })
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('default scheduled cloud-backup times are 1 PM / 6 PM / 8 PM', async () => {
    const settings = await window.evaluate(() => window.api.settings.getBackupSettings())
    expect(settings.scheduledTimes).toEqual(['13:00', '18:00', '20:00'])

    // And they appear as editable (removable) chips on the Settings screen (real UI).
    await window.locator('nav').getByRole('link', { name: /^Settings/ }).click()
    for (const time of ['13:00', '18:00', '20:00']) {
      await expect(window.getByRole('button', { name: `Remove ${time}` })).toBeVisible()
    }
    await shoot(window, '14-backup-default-times')
  })

  test('fresh-device backup check reports "not connected" cleanly (no Drive linked)', async () => {
    const info = await window.evaluate(() => window.api.googleDrive.getRemoteBackupInfo())
    expect(info.connected).toBe(false)
    expect(info.backup).toBeNull()
  })
})
