import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, SHARED_PROFILE_DIR, shoot } from '../fixtures/support'

const SUFFIX = Date.now().toString().slice(-7)
const CUSTOMER_NAME = `E2E Payment Customer ${SUFFIX}`
const CUSTOMER_PHONE = `0303${SUFFIX}`
const DEVICE_MODEL = `E2E Payment Model ${SUFFIX}`

test.describe.serial('Payments', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(SHARED_PROFILE_DIR))

    // Set up a repair with an outstanding balance to record payments against.
    await window.locator('nav').getByRole('link', { name: /^Repairs/ }).click()
    await window.getByRole('button', { name: 'New Repair Order' }).click()
    const pickerInput = window.locator('form').locator('input[type=text]').first()
    await pickerInput.fill(CUSTOMER_NAME)
    await window.getByText('Create New Customer', { exact: false }).click()
    await window.locator('input[type=tel]').first().fill(CUSTOMER_PHONE)
    await window.getByRole('button', { name: 'Save' }).first().click()
    await expect(window.getByText(CUSTOMER_NAME)).toBeVisible({ timeout: 5_000 })

    await window.getByLabel(/Device Brand/).fill('Xiaomi')
    await window.getByLabel(/Device Model/).fill(DEVICE_MODEL)
    await window.locator('textarea').first().fill('E2E test: payment flow')
    await window.getByLabel(/Total Price/).fill('4000')
    await window.getByRole('button', { name: 'Save' }).click()
    await expect(window.getByText(DEVICE_MODEL)).toBeVisible({ timeout: 10_000 })
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('records a partial payment and updates the remaining balance', async () => {
    await window.getByRole('button', { name: 'Record Payment' }).click()
    await expect(window.getByText('Record Payment', { exact: true }).last()).toBeVisible()

    await window.getByLabel(/^Amount/).fill('1500')
    await shoot(window, '04-payments-record-form')
    await window.getByRole('button', { name: 'Save' }).click()

    await expect(window.getByText('Payment Type', { exact: true })).not.toBeVisible()
    await expect(window.getByText('1500.00').first()).toBeVisible({ timeout: 5_000 })
    // repairPrice 4000 - advance 0 - 1500 paid = 2500 remaining
    await expect(window.getByText('2500.00').first()).toBeVisible()
    await shoot(window, '04-payments-after-partial')
  })

  test('shows the overpayment confirmation dialog and allows recording anyway', async () => {
    await window.getByRole('button', { name: 'Record Payment' }).click()
    await window.getByLabel(/^Amount/).fill('9999')
    await window.getByRole('button', { name: 'Save' }).click()

    await expect(window.getByText('Amount exceeds remaining balance')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByText('9999.00')).toBeVisible()
    await shoot(window, '04-payments-overpayment-confirm')

    await window.getByRole('button', { name: 'Record Anyway' }).click()
    await expect(window.getByText('Amount exceeds remaining balance')).not.toBeVisible()
    await expect(window.getByText('9999.00').first()).toBeVisible({ timeout: 5_000 })
    // Remaining balance goes negative (overpaid): 2500 - 9999 = -7499
    await expect(window.getByText('-7499.00').first()).toBeVisible()
    await shoot(window, '04-payments-after-overpayment')
  })

  test('the Payments list screen shows the recorded payments', async () => {
    await window.locator('nav').getByRole('link', { name: /^Payments/ }).click()
    await expect(window.locator('main').getByText('Payments', { exact: true })).toBeVisible()
    await expect(window.getByText(CUSTOMER_NAME).first()).toBeVisible({ timeout: 5_000 })
    await shoot(window, '04-payments-list')
  })
})
