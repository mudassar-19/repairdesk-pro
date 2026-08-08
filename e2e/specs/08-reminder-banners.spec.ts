import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, SHARED_PROFILE_DIR, shoot } from '../fixtures/support'

test.describe.serial('Dashboard reminder banners', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(SHARED_PROFILE_DIR))
    await window.locator('nav').getByRole('link', { name: /^Dashboard/ }).click()
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('Overdue Delivery Reminder: Extend Delivery Date updates the row', async () => {
    const banner = window.locator('[data-testid="overdue-delivery-banner"]')
    await expect(banner).toBeVisible({ timeout: 10_000 })
    await shoot(window, '08-overdue-delivery-banner')

    const firstRow = banner.locator('div.flex.flex-wrap.items-center.justify-between.gap-md.px-lg.py-md').first()
    const rowText = await firstRow.innerText()

    await firstRow.getByRole('button', { name: 'Extend Delivery Date' }).click()
    await window.getByRole('button', { name: '+1 week' }).click()
    await window.getByRole('button', { name: 'Update Date' }).click()

    // The row is removed from the overdue list once its date is extended.
    await expect(banner.getByText(rowText.split('\n')[0])).toHaveCount(0, { timeout: 5_000 })
    await shoot(window, '08-overdue-delivery-after-extend')
  })

  test('Overdue Delivery Reminder: Mark as Delivered removes the row', async () => {
    const banner = window.locator('[data-testid="overdue-delivery-banner"]')
    const countBadgeBefore = await banner.locator('div.flex.items-center.gap-2 > span').last().innerText()

    const firstRow = banner.locator('div.flex.flex-wrap.items-center.justify-between.gap-md.px-lg.py-md').first()
    // "Mark as Delivered" now records the full remaining balance as a payment
    // and delivers in one step — no track-as-Udhaar prompt any more.
    await firstRow.getByRole('button', { name: 'Mark as Delivered' }).click()

    await expect(async () => {
      const countBadgeAfter = await banner.locator('div.flex.items-center.gap-2 > span').last().innerText()
      expect(Number(countBadgeAfter)).toBeLessThan(Number(countBadgeBefore))
    }).toPass({ timeout: 5_000 })
    await shoot(window, '08-overdue-delivery-after-mark-delivered')
  })

  test('Overdue Udhaar Reminder: Extend Due Date updates the row', async () => {
    const banner = window.locator('[data-testid="overdue-udhaar-banner"]')
    await expect(banner).toBeVisible({ timeout: 10_000 })
    await shoot(window, '08-overdue-udhaar-banner')

    const firstRow = banner.locator('div.flex.flex-wrap.items-center.justify-between.gap-md.px-lg.py-md').first()
    const rowText = await firstRow.innerText()

    await firstRow.getByRole('button', { name: 'Extend Due Date' }).click()
    await window.getByRole('button', { name: '+1 week' }).click()
    await window.getByRole('button', { name: 'Update Date' }).click()

    await expect(banner.getByText(rowText.split('\n')[0])).toHaveCount(0, { timeout: 5_000 })
    await shoot(window, '08-overdue-udhaar-after-extend')
  })

  test('Overdue Udhaar Reminder: Record Settlement resolves the row', async () => {
    const banner = window.locator('[data-testid="overdue-udhaar-banner"]')
    const countBadgeBefore = await banner.locator('div.flex.items-center.gap-2 > span').last().innerText()

    const firstRow = banner.locator('div.flex.flex-wrap.items-center.justify-between.gap-md.px-lg.py-md').first()
    const rowText = await firstRow.innerText()
    const amountMatch = rowText.match(/PKR ([\d,.]+)/)
    const amount = amountMatch ? amountMatch[1].replace(/,/g, '') : '100'

    await firstRow.getByRole('button', { name: 'Record Settlement' }).click()
    await window.getByLabel('Settlement Amount', { exact: true }).fill(amount)
    await shoot(window, '08-overdue-udhaar-settlement-form')
    await window.getByRole('button', { name: 'Save' }).click()

    await expect(async () => {
      const countBadgeAfter = await banner.locator('div.flex.items-center.gap-2 > span').last().innerText()
      expect(Number(countBadgeAfter)).toBeLessThan(Number(countBadgeBefore))
    }).toPass({ timeout: 5_000 })
    await shoot(window, '08-overdue-udhaar-after-settlement')
  })
})
