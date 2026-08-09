import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, authenticateOffline, shoot } from '../fixtures/support'

/**
 * Dashboard "Repairs Needing Action" — excludes delivered/cancelled and sorts
 * by nearest estimated delivery date (most overdue first, no-date last).
 */

const SUFFIX = Date.now().toString().slice(-6)

test.describe.serial('Dashboard — Repairs Needing Action', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('needing-action')))
    await authenticateOffline(window)
    await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 20_000 })
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('excludes delivered/cancelled and sorts by nearest delivery date', async () => {
    await window.evaluate(async (suffix) => {
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const day = (offset: number) => {
        const d = new Date()
        d.setDate(d.getDate() + offset)
        return fmt(d)
      }
      const customer = await window.api.customers.create({ name: `NA Cust ${suffix}`, phone: `03006${suffix}` })
      const base = { customerId: customer.id, deviceBrand: 'ZZ', issue: 'x', costPrice: 0, repairPrice: 1000, advanceAmount: 0 }
      await window.api.repairs.create({ ...base, deviceModel: `SOON-${suffix}`, estimatedDeliveryDate: day(2) })
      await window.api.repairs.create({ ...base, deviceModel: `OVERDUE-${suffix}`, estimatedDeliveryDate: day(-1) })
      await window.api.repairs.create({ ...base, deviceModel: `LATER-${suffix}`, estimatedDeliveryDate: day(5) })
      await window.api.repairs.create({ ...base, deviceModel: `NODATE-${suffix}` }) // no delivery date
      const done = await window.api.repairs.create({ ...base, deviceModel: `DONE-${suffix}`, estimatedDeliveryDate: day(1) })
      await window.api.repairs.deliverWithFullPayment(done.id) // delivered → must be excluded
    }, SUFFIX)

    // Re-enter the Dashboard fresh.
    await window.locator('nav').getByRole('link', { name: /^Customers/ }).click()
    await window.locator('nav').getByRole('link', { name: /^Dashboard/ }).click()

    // Renamed section.
    await expect(window.getByText('Repairs Needing Action', { exact: true })).toBeVisible()

    // Delivered order is NOT listed.
    await expect(window.getByTestId('needing-action-row').filter({ hasText: `DONE-${SUFFIX}` })).toHaveCount(0)

    // Order: most-overdue → soonest → later → no-date last.
    const texts = await window.getByTestId('needing-action-row').allTextContents()
    const order = texts
      .map((t) => t.match(/(OVERDUE|SOON|LATER|NODATE)/)?.[1])
      .filter((x): x is string => Boolean(x))
    expect(order).toEqual(['OVERDUE', 'SOON', 'LATER', 'NODATE'])
    await shoot(window, '17-needing-action')
  })
})
