import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, shoot } from '../fixtures/support'

/**
 * Part E — the in-app real-time bus. Proves a write originating anywhere
 * updates a screen that is already mounted, with NO navigation, refetch, or
 * refocus: we stay on the Dashboard the whole time and drive a write through
 * the app's own API (which fires the preload's post-write emit), then assert
 * the Dashboard's own DOM reflects it.
 */

async function authenticate(window: Page): Promise<void> {
  const deviceId = await window.evaluate(() => window.api.auth.getDeviceId())
  await window.evaluate(async (id) => {
    await window.api.auth.saveLocalSession({
      uid: 'qa-e2e-test-uid',
      email: 'qa-e2e@repairdesk.local',
      deviceId: id,
      refreshToken: 'not-real',
      issuedAt: new Date().toISOString()
    })
  }, deviceId)
  await window.reload()
  await window.waitForLoadState('domcontentloaded')
  await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 20_000 })
}

test.describe.serial('Real-time updates (Part E)', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('realtime')))
    await authenticate(window)
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('a write from elsewhere updates the mounted Dashboard with no navigation', async () => {
    // We are on the Dashboard (fresh profile → Today's Revenue 0.00). Do NOT navigate.
    await expect(window.locator('main')).toContainText('0.00')

    // Simulate a write happening anywhere in the app (here: booking a repair
    // with an advance) via the real API — this goes through the same preload
    // emit every UI surface uses.
    await window.evaluate(async () => {
      const customer = await window.api.customers.create({ name: 'RT Cust', phone: '03009998877' })
      await window.api.repairs.create({
        customerId: customer.id,
        deviceBrand: 'RT',
        deviceModel: 'RT1',
        issue: 'realtime',
        costPrice: 0,
        repairPrice: 1234,
        advanceAmount: 1234
      })
    })

    // Without any navigation/refocus, the Dashboard's own cards update live.
    await expect(window.locator('main')).toContainText('1234.00', { timeout: 10_000 })
    await shoot(window, '11-realtime-dashboard-live')
  })
})
