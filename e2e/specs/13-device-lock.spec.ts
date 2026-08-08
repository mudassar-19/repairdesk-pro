import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, shoot } from '../fixtures/support'

/**
 * Part H — per-device account binding. Exercised through the REAL running app:
 * every call goes through the actual auth IPC handlers and their on-disk files
 * (device-owner.json, session.enc). Firebase isn't involved — the lock lives at
 * the saveLocalSession gate, which is what the login screen calls after a valid
 * sign-in — so this reproduces exactly what "valid credentials, wrong device"
 * does, without needing two real accounts.
 */

function saveSession(window: Page, uid: string, email: string) {
  return window.evaluate(
    async ({ uid, email }) => {
      const deviceId = await window.api.auth.getDeviceId()
      return window.api.auth.saveLocalSession({
        uid,
        email,
        deviceId,
        refreshToken: 'not-real',
        issuedAt: new Date().toISOString()
      })
    },
    { uid, email }
  )
}

test.describe.serial('Device lock (Part H)', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('device-lock')))
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('first account binds the device and reaches the Dashboard', async () => {
    // Fresh install → login screen.
    await expect(window.getByText('Sign In', { exact: true })).toBeVisible()

    const result = await saveSession(window, 'owner-A', 'owner-a@example.com')
    expect(result.ok).toBe(true)

    // Owner is let in (real UI: Dashboard renders after reload).
    await window.reload()
    await window.waitForLoadState('domcontentloaded')
    await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 20_000 })

    const owner = await window.evaluate(() => window.api.auth.getDeviceOwner())
    expect(owner?.ownerUid).toBe('owner-A')
    await shoot(window, '13-device-owner-dashboard')
  })

  test('a different valid account is refused and cannot overwrite the session', async () => {
    const result = await saveSession(window, 'intruder-B', 'intruder-b@example.com')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('device-locked')
    expect(result.ownerEmail).toBe('owner-a@example.com')

    // The refused attempt left the owner's session untouched.
    const session = await window.evaluate(() => window.api.auth.getLocalSession())
    expect(session?.uid).toBe('owner-A')
  })

  test('distributor reset re-binds the device to a new account', async () => {
    await window.evaluate(() => window.api.auth.resetDeviceBinding())

    const result = await saveSession(window, 'newowner-C', 'c@example.com')
    expect(result.ok).toBe(true)

    const owner = await window.evaluate(() => window.api.auth.getDeviceOwner())
    expect(owner?.ownerUid).toBe('newowner-C')
  })
})
