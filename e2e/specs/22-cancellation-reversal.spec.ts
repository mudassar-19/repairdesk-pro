import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, shoot } from '../fixtures/support'

/**
 * Real rendered-UI verification of the cancellation financial-reversal fix —
 * the exact reported bug: a repair created with an advance shows up in Dashboard
 * Revenue/Profit, and cancelling it must reverse that everywhere (Dashboard) and
 * mark its payment "Cancelled" on the Payments page (point 6) instead of leaving
 * phantom revenue behind. Also asserts the Delete button is gone from the Repair
 * Detail page and Cancel Order is a first-class button there (points 1–2).
 * Self-contained: own fresh profile + injected offline session (no Firebase).
 */

const SUFFIX = Date.now().toString().slice(-6)
const CUST = { name: `Cancel ${SUFFIX}`, phone: `03009${SUFFIX}` }
const MODEL = `CANCEL-${SUFFIX}`

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

const summary = (window: Page) => window.evaluate(() => window.api.dashboard.getSummary())

test.describe.serial('Cancellation reverses all financial impact', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('cancel-reversal')))
    await authenticate(window)
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('1. repair with an advance shows Revenue + Profit on the Dashboard', async () => {
    await window.locator('nav').getByRole('link', { name: /^Repairs/ }).click()
    await window.getByRole('button', { name: 'New Repair Order' }).click()
    const picker = window.locator('form').locator('input[type=text]').first()
    await picker.fill(CUST.name)
    await window.getByText('Create New Customer', { exact: false }).click()
    await window.locator('input[type=tel]').first().fill(CUST.phone)
    await window.getByRole('button', { name: 'Save' }).first().click()
    await expect(window.getByText(CUST.name)).toBeVisible({ timeout: 5_000 })

    await window.getByLabel(/Device Brand/).fill('Samsung')
    await window.getByLabel(/Device Model/).fill(MODEL)
    await window.locator('textarea').first().fill('E2E cancel-reversal')
    await window.getByLabel(/^Cost Price/).fill('2300')
    await window.getByLabel(/Total Price/).fill('4500')
    await window.getByLabel(/^Advance Amount/).fill('1000')
    await window.getByRole('button', { name: 'Save' }).click()
    await expect(window.getByText(`Samsung ${MODEL}`)).toBeVisible({ timeout: 10_000 })

    // Fresh profile → these are the only figures so far.
    const s = await summary(window)
    expect(s.todayRevenue).toBeCloseTo(1000, 2)
    expect(s.todayProfit).toBeCloseTo((1000 * (4500 - 2300)) / 4500, 2)
    expect(s.monthlyRevenue).toBeCloseTo(1000, 2)
    expect(s.netProfit).toBeCloseTo((1000 * (4500 - 2300)) / 4500, 2)
    await shoot(window, '22-01-before-cancel')
  })

  test('2. Payments page shows the advance as active (no badge, counted in total)', async () => {
    await window.locator('nav').getByRole('link', { name: /^Payments/ }).click()
    const row = window.locator('tr', { hasText: CUST.name })
    await expect(row).toContainText('Advance')
    await expect(row).toContainText('1000.00')
    await expect(row).not.toContainText('Cancelled')
  })

  test('3. Cancel Order is a first-class button and Delete is gone on the detail page', async () => {
    await window.locator('nav').getByRole('link', { name: /^Repairs/ }).click()
    await window.getByText(`Samsung ${MODEL}`).click()
    await expect(window.getByText(`Samsung ${MODEL}`)).toBeVisible()
    await expect(window.getByRole('button', { name: 'Delete' })).toHaveCount(0)
    await expect(window.getByRole('button', { name: 'Cancel Order' })).toBeVisible()
  })

  test('4. cancelling reverses Dashboard Revenue + Profit to zero', async () => {
    await window.getByRole('button', { name: 'Cancel Order' }).click()
    await window.getByRole('alertdialog').getByRole('button', { name: 'Cancel Order' }).click()
    await expect(window.getByText('Cancelled', { exact: true }).first()).toBeVisible({ timeout: 5_000 })

    const s = await summary(window)
    expect(s.todayRevenue).toBeCloseTo(0, 2)
    expect(s.todayProfit).toBeCloseTo(0, 2)
    expect(s.monthlyRevenue).toBeCloseTo(0, 2)
    expect(s.monthlyProfit).toBeCloseTo(0, 2)
    expect(s.netProfit).toBeCloseTo(0, 2)
    await shoot(window, '22-02-after-cancel')
  })

  test('5. Payments page keeps the row but flags it "Cancelled" (point 6)', async () => {
    await window.locator('nav').getByRole('link', { name: /^Payments/ }).click()
    const row = window.locator('tr', { hasText: CUST.name })
    // The money must NOT silently disappear — the row is still there…
    await expect(row).toContainText('1000.00')
    // …but clearly flagged so it's obviously no longer active revenue.
    await expect(row).toContainText('Cancelled')
    await shoot(window, '22-03-payments-cancelled-badge')
  })

  test('6. the cancellation is logged in the Activity timeline with the reversed amount', async () => {
    await window.locator('nav').getByRole('link', { name: /^Activity/ }).click()
    await expect(window.getByText(/Repair cancelled/).first()).toBeVisible({ timeout: 5_000 })
    await expect(window.getByText(/reversed from revenue/).first()).toBeVisible()
    await shoot(window, '22-04-activity-log')
  })
})
