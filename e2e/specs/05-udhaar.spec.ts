import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, SHARED_PROFILE_DIR, shoot } from '../fixtures/support'

const SUFFIX = Date.now().toString().slice(-7)
const PERSON_SETTLE = `E2E Udhaar Settle ${SUFFIX}`
const PERSON_EXTEND = `E2E Udhaar Extend ${SUFFIX}`

test.describe.serial('Udhaar', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(SHARED_PROFILE_DIR))
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('creates a standalone receivable Udhaar entry for a non-customer', async () => {
    await window.locator('nav').getByRole('link', { name: /^Udhaar/ }).click()
    await window.getByRole('button', { name: 'Add Udhaar' }).click()
    await expect(window.getByText('Add Udhaar', { exact: true })).toBeVisible()

    await window.getByRole('button', { name: 'Someone Else' }).click()
    await window.getByLabel(/^Name/).first().fill(PERSON_SETTLE)
    await window.getByLabel(/^Amount/).fill('5000')
    await window.getByRole('button', { name: 'Save' }).click()

    await expect(window.getByText(PERSON_SETTLE)).toBeVisible({ timeout: 10_000 })
    await shoot(window, '05-udhaar-after-create')
  })

  test('records a partial settlement, then fully settles and locks the entry', async () => {
    const row = window.locator('tr', { hasText: PERSON_SETTLE })
    await row.getByRole('button', { name: 'Record Settlement' }).click()
    await window.getByLabel(/Amount/).fill('2000')
    await window.getByRole('button', { name: 'Save' }).click()

    await expect(row.getByText('Partially Settled')).toBeVisible({ timeout: 5_000 })
    await shoot(window, '05-udhaar-partially-settled')

    await row.getByRole('button', { name: 'Record Settlement' }).click()
    await window.getByLabel(/Amount/).fill('3000')
    await window.getByRole('button', { name: 'Save' }).click()

    await expect(row.getByText('Settled', { exact: true })).toBeVisible({ timeout: 5_000 })
    await expect(row.getByRole('button', { name: 'Record Settlement' })).toHaveCount(0)
    await expect(row.getByRole('button', { name: 'Extend Due Date' })).toHaveCount(0)
    await shoot(window, '05-udhaar-settled-locked')
  })

  test('extends the due date on an open entry via the inline quick-pick control', async () => {
    await window.getByRole('button', { name: 'Add Udhaar' }).click()
    await window.getByRole('button', { name: 'Someone Else' }).click()
    await window.getByLabel(/^Name/).first().fill(PERSON_EXTEND)
    await window.getByLabel(/^Amount/).fill('1200')
    await window.getByLabel(/Due Date/).fill('2026-01-01')
    await window.getByRole('button', { name: 'Save' }).click()
    await expect(window.getByText(PERSON_EXTEND)).toBeVisible({ timeout: 10_000 })

    const row = window.locator('tr', { hasText: PERSON_EXTEND })
    await row.getByRole('button', { name: 'Extend Due Date' }).click()
    await shoot(window, '05-udhaar-extend-control-open')

    await window.getByRole('button', { name: '+1 week' }).click()
    await window.getByRole('button', { name: 'Update Date' }).click()

    await expect(window.getByRole('button', { name: '+1 week' })).not.toBeVisible({ timeout: 5_000 })
    await shoot(window, '05-udhaar-after-extend')
  })
})
