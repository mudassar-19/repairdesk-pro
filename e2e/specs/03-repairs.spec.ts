import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, SHARED_PROFILE_DIR, shoot } from '../fixtures/support'

const SUFFIX = Date.now().toString().slice(-7)
const NEW_CUSTOMER_NAME = `E2E Repair Customer ${SUFFIX}`
const NEW_CUSTOMER_PHONE = `0302${SUFFIX}`
const DEVICE_MODEL_A = `E2E Model A ${SUFFIX}`
const DEVICE_MODEL_B = `E2E Model B ${SUFFIX}`

test.describe.serial('Repairs', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(SHARED_PROFILE_DIR))
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('creates a repair order for a brand-new customer, fully paid up front', async () => {
    await window.locator('nav').getByRole('link', { name: /^Repairs/ }).click()
    await window.getByRole('button', { name: 'New Repair Order' }).click()
    await expect(window.getByText('New Repair Order', { exact: true })).toBeVisible()

    // Customer picker: type a name that doesn't exist, then "Create New Customer".
    const pickerInput = window.locator('form').locator('input[type=text]').first()
    await pickerInput.fill(NEW_CUSTOMER_NAME)
    await window.getByText('Create New Customer', { exact: false }).click()
    await window.locator('input[type=tel]').first().fill(NEW_CUSTOMER_PHONE)
    // The picker's own inline "Save" (type=button) precedes the outer form's submit Save in DOM order.
    await window.getByRole('button', { name: 'Save' }).first().click()
    await expect(window.getByText(NEW_CUSTOMER_NAME)).toBeVisible({ timeout: 5_000 })

    await window.getByLabel(/Device Brand/).fill('Samsung')
    await window.getByLabel(/Device Model/).fill(DEVICE_MODEL_A)
    await window.locator('textarea').first().fill('E2E test: cracked screen')
    await window.getByLabel(/^Cost Price/).fill('2000')
    await window.getByLabel(/Total Price/).fill('5000')
    await window.getByLabel(/^Advance Amount/).fill('5000')
    await shoot(window, '03-repairs-new-form-new-customer')

    await window.getByRole('button', { name: 'Save' }).click()
    await expect(window.getByText(DEVICE_MODEL_A)).toBeVisible({ timeout: 10_000 })
    await shoot(window, '03-repairs-detail-after-create')
  })

  test('walks a repair through pending -> completed -> delivered', async () => {
    await expect(window.getByText(DEVICE_MODEL_A)).toBeVisible()

    await window.getByRole('button', { name: 'Mark as Completed' }).click()
    await expect(window.getByText('Completed', { exact: true }).first()).toBeVisible({ timeout: 5_000 })

    // Fully paid up front (advance == total), so "Mark as Delivered" records no
    // new payment — it just delivers. (There is no "Deliver on Credit" option
    // here since nothing is owed.)
    await window.getByRole('button', { name: 'Mark as Delivered' }).click()
    await expect(window.getByText('Delivered', { exact: true }).first()).toBeVisible({ timeout: 5_000 })
    await shoot(window, '03-repairs-delivered')
  })

  test('a delivered (locked) repair shows no status-change actions', async () => {
    await expect(window.getByText('Change Status', { exact: true })).not.toBeVisible()
    await expect(window.getByRole('button', { name: 'Mark as Delivered' })).not.toBeVisible()
    await expect(window.getByRole('button', { name: 'Mark as Completed' })).not.toBeVisible()
    await expect(window.getByRole('button', { name: 'More actions' })).not.toBeVisible()
    await shoot(window, '03-repairs-locked-detail')

    // Also confirm the list row has no action buttons for this repair.
    await window.locator('nav').getByRole('link', { name: /^Repairs/ }).click()
    const row = window.locator('tr', { hasText: DEVICE_MODEL_A })
    await expect(row).toBeVisible()
    await expect(row.getByRole('button', { name: 'Mark as Delivered' })).toHaveCount(0)
    await expect(row.getByRole('button', { name: 'More actions' })).toHaveCount(0)
  })

  test('creates a second repair for that same (now existing) customer', async () => {
    await window.getByRole('button', { name: 'New Repair Order' }).click()
    const pickerInput = window.locator('form').locator('input[type=text]').first()
    await pickerInput.fill(NEW_CUSTOMER_NAME)
    await window.getByText(NEW_CUSTOMER_NAME).first().click()

    await window.getByLabel(/Device Brand/).fill('Apple')
    await window.getByLabel(/Device Model/).fill(DEVICE_MODEL_B)
    await window.locator('textarea').first().fill('E2E test: battery replacement')
    await window.getByLabel(/Total Price/).fill('3000')
    await window.getByRole('button', { name: 'Save' }).click()

    await expect(window.getByText(DEVICE_MODEL_B)).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText(NEW_CUSTOMER_NAME)).toBeVisible()
  })

  test('cancels a pending repair via the more-actions menu', async () => {
    await window.getByRole('button', { name: 'More actions' }).click()
    await window.getByRole('menuitem', { name: 'Cancel Order' }).click()
    await expect(window.getByText('Cancelled', { exact: true }).first()).toBeVisible({ timeout: 5_000 })
    await shoot(window, '03-repairs-cancelled')

    await expect(window.getByText('Change Status', { exact: true })).not.toBeVisible()
    await expect(window.getByRole('button', { name: 'More actions' })).not.toBeVisible()
  })
})
