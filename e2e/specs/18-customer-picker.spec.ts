import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, authenticateOffline, shoot } from '../fixtures/support'

/**
 * CustomerPicker scalability fix (shared component): "Create New Customer" is
 * pinned above the (scrollable) results list, and carries a typed phone number
 * into the new-customer form. Verified in BOTH the main Repair form and POS Mode.
 */

const SUFFIX = Date.now().toString().slice(-6)

async function openPickerOnRepairForm(window: Page): Promise<void> {
  await window.locator('nav').getByRole('link', { name: /^Repairs/ }).click()
  await window.getByRole('button', { name: 'New Repair Order' }).click()
}

async function openPickerInPos(window: Page): Promise<void> {
  await window.getByRole('button', { name: /Switch to POS Mode/ }).click()
  // New Order tab is the default; its customer picker is on screen.
}

async function assertPinnedAboveResults(window: Page): Promise<void> {
  // Type a common substring that matches many seeded customers so the results list is long.
  const searchInput = window.locator('input[type=text]').first()
  await searchInput.fill('PickCust')
  const firstResult = window.getByRole('button', { name: /PickCust/ }).first()
  await expect(firstResult).toBeVisible()

  const createBtn = window.getByTestId('create-new-customer')
  await expect(createBtn).toBeVisible()

  // The create button sits ABOVE the results (not buried at the bottom of the scroll list).
  const createBox = await createBtn.boundingBox()
  const resultBox = await firstResult.boundingBox()
  expect(createBox && resultBox && createBox.y < resultBox.y).toBe(true)
}

async function assertPhonePrefill(window: Page, phone: string): Promise<void> {
  const searchInput = window.locator('input[type=text]').first()
  await searchInput.fill(phone)
  await window.getByTestId('create-new-customer').click()
  // Smart pre-fill: a phone-shaped query lands in the Phone field.
  await expect(window.locator('input[type=tel]').first()).toHaveValue(phone)
}

test.describe.serial('CustomerPicker — pinned Create + smart pre-fill', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('customer-picker')))
    await authenticateOffline(window)
    await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 20_000 })
    // Seed enough customers that the picker's results list scrolls.
    await window.evaluate(async (suffix) => {
      for (let i = 0; i < 12; i++) {
        // Valid 11-digit "03…" numbers, unique per i, distinct from the prefill
        // values asserted below (03009…, 03018…).
        await window.api.customers.create({ name: `PickCust ${i} ${suffix}`, phone: `032${String(i).padStart(2, '0')}${suffix}` })
      }
    }, SUFFIX)
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('Repair form: Create button is pinned above results, and a typed phone pre-fills', async () => {
    await openPickerOnRepairForm(window)
    await assertPinnedAboveResults(window)
    await shoot(window, '18-picker-repair-form')
    await assertPhonePrefill(window, `03009${SUFFIX}`)
  })

  test('POS New Order tab: same pinned Create + phone pre-fill (shared component)', async () => {
    // Leave the repair form back to the dashboard first.
    await window.locator('nav').getByRole('link', { name: /^Dashboard/ }).click()
    await openPickerInPos(window)
    await assertPinnedAboveResults(window)
    await assertPhonePrefill(window, `03018${SUFFIX}`)
    await shoot(window, '18-picker-pos')
  })
})
