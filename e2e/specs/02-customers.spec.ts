import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, SHARED_PROFILE_DIR, shoot } from '../fixtures/support'

const UNIQUE_SUFFIX = Date.now().toString().slice(-7)
export const NEW_CUSTOMER_NAME = `E2E Test Customer ${UNIQUE_SUFFIX}`
export const NEW_CUSTOMER_PHONE = `0301${UNIQUE_SUFFIX}`
const EDITED_NAME = `${NEW_CUSTOMER_NAME} (Edited)`

test.describe.serial('Customers', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(SHARED_PROFILE_DIR))
    await window.locator('nav').getByRole('link', { name: /^Customers/ }).click()
    await expect(window.locator('main').getByText('Customers', { exact: true })).toBeVisible()
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('creates a new customer via the UI', async () => {
    await window.getByRole('button', { name: 'Add Customer' }).click()
    await expect(window.getByText('Add Customer', { exact: true })).toBeVisible()

    await window.locator('input[type=text]').first().fill(NEW_CUSTOMER_NAME)
    await window.locator('input[type=tel]').fill(NEW_CUSTOMER_PHONE)
    await shoot(window, '02-customers-new-form-filled')
    await window.getByRole('button', { name: 'Save' }).click()

    await expect(window.getByText(NEW_CUSTOMER_NAME).first()).toBeVisible({ timeout: 10_000 })
    await shoot(window, '02-customers-detail-after-create')
  })

  test('shows the duplicate-phone warning and blocks save', async () => {
    await window.locator('nav').getByRole('link', { name: /^Customers/ }).click()
    await window.getByRole('button', { name: 'Add Customer' }).click()

    await window.locator('input[type=text]').first().fill('Duplicate Phone Test')
    await window.locator('input[type=tel]').fill(NEW_CUSTOMER_PHONE)

    await expect(window.getByText('Customer already exists')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByText(NEW_CUSTOMER_NAME)).toBeVisible()
    await expect(window.getByRole('button', { name: 'Save' })).toBeDisabled()
    await shoot(window, '02-customers-duplicate-phone-warning')

    await window.getByRole('button', { name: 'Cancel' }).click()
  })

  test('edits an existing customer', async () => {
    await window.locator('nav').getByRole('link', { name: /^Customers/ }).click()
    await window.locator('input[type=text]').fill(NEW_CUSTOMER_NAME)
    await window.getByText(NEW_CUSTOMER_NAME).first().click()

    await window.getByRole('button', { name: 'Edit' }).click()
    await expect(window.getByText('Edit Customer', { exact: true })).toBeVisible()

    const nameInput = window.locator('input[type=text]').first()
    await nameInput.fill(EDITED_NAME)
    await window.getByRole('button', { name: 'Save' }).click()

    await expect(window.getByText(EDITED_NAME).first()).toBeVisible({ timeout: 10_000 })
    await shoot(window, '02-customers-after-edit')
  })
})
