import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, shoot } from '../fixtures/support'

/**
 * Part H — device lock (Firestore-backed redesign).
 *
 * The AUTHORITATIVE binding now lives in Firestore (device_locks/{deviceId}) and
 * is enforced in the renderer (features/auth/lib/deviceLock.ts → verifyDevice)
 * BEFORE any session is saved. That server round-trip and its full decision
 * matrix — including the "delete the local file to re-register" tamper attempts,
 * both online and offline — are covered deterministically by the real decision
 * code in scripts/deviceLockDecision.test.mts. Firebase/Firestore aren't
 * reachable from this offline E2E harness, so the server gate itself is proven
 * there, not here.
 *
 * What THIS E2E proves through the real running app + real auth IPC + on-disk
 * files is the OFFLINE FAST-PATH's data source: device-owner.json is written as
 * a local cache on a successful (already-gated) login, read back via
 * getDeviceOwner, and cleared by resetDeviceBinding for admin re-onboarding.
 * saveLocalSession is deliberately NO LONGER a gate — it trusts that the
 * renderer's Firestore check already passed — so it is tested here only as the
 * cache writer it now is.
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

test.describe.serial('Device lock (Part H, Firestore-backed)', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('device-lock')))
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('a gated login writes the local offline-cache and reaches the Dashboard', async () => {
    // Fresh install → login screen.
    await expect(window.getByText('Sign In', { exact: true })).toBeVisible()

    // Post-gate: the renderer already verified this account against Firestore,
    // so saveLocalSession persists the session and caches the owner locally.
    const result = await saveSession(window, 'owner-A', 'owner-a@example.com')
    expect(result.ok).toBe(true)

    await window.reload()
    await window.waitForLoadState('domcontentloaded')
    await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 20_000 })

    const owner = await window.evaluate(() => window.api.auth.getDeviceOwner())
    expect(owner?.ownerUid).toBe('owner-A')
    expect(owner?.ownerEmail).toBe('owner-a@example.com')
    await shoot(window, '13-device-owner-dashboard')
  })

  test('the local cache is refreshed to the authoritative owner on each save (self-correcting)', async () => {
    // Re-saving keeps the cache pointed at the real owner — this is what makes a
    // tampered/stale device-owner.json self-correct to the authoritative owner
    // the next time the (already-gated) owner logs in.
    const result = await saveSession(window, 'owner-A', 'owner-a@example.com')
    expect(result.ok).toBe(true)

    const owner = await window.evaluate(() => window.api.auth.getDeviceOwner())
    expect(owner?.ownerUid).toBe('owner-A')

    // The owner's encrypted session is intact.
    const session = await window.evaluate(() => window.api.auth.getLocalSession())
    expect(session?.uid).toBe('owner-A')
  })

  test('resetDeviceBinding clears ONLY the local cache (admin re-onboarding, local half)', async () => {
    await window.evaluate(() => window.api.auth.resetDeviceBinding())

    // Local offline fast-path is now invalidated; the authoritative reset is the
    // admin deleting the Firestore doc in the console.
    const cleared = await window.evaluate(() => window.api.auth.getDeviceOwner())
    expect(cleared).toBeNull()

    // After the admin has cleared Firestore too, the next login re-binds — the
    // local cache is rewritten to the new owner.
    const result = await saveSession(window, 'newowner-C', 'c@example.com')
    expect(result.ok).toBe(true)

    const owner = await window.evaluate(() => window.api.auth.getDeviceOwner())
    expect(owner?.ownerUid).toBe('newowner-C')
  })
})
