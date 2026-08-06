import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, SHARED_PROFILE_DIR, shoot } from '../fixtures/support'

const SUFFIX = Date.now().toString().slice(-7)
const DESCRIPTION = `E2E Expense ${SUFFIX}`

test.describe.serial('Expenses', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(SHARED_PROFILE_DIR))
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('adds a new expense and it appears in the list', async () => {
    await window.locator('nav').getByRole('link', { name: /^Expenses/ }).click()
    await window.getByRole('button', { name: 'Add Expense' }).click()
    await expect(window.getByText('Add Expense', { exact: true })).toBeVisible()

    await window.getByLabel(/^Amount/).fill('750')
    await window.getByLabel(/^Description/).fill(DESCRIPTION)
    await shoot(window, '06-expenses-new-form')
    await window.getByRole('button', { name: 'Save' }).click()

    await expect(window.getByText(DESCRIPTION)).toBeVisible({ timeout: 10_000 })
    await shoot(window, '06-expenses-after-create')
  })

  test('adds a recurring custom-category expense', async () => {
    const RECURRING_DESC = `${DESCRIPTION} Recurring`
    await window.getByRole('button', { name: 'Add Expense' }).click()
    await window.locator('select').first().selectOption({ label: 'Custom Category…' })
    await window.getByLabel(/^Custom Category Name/).fill('E2E Custom Category')
    await window.getByLabel(/^Amount/).fill('300')
    await window.getByLabel(/^Description/).fill(RECURRING_DESC)
    await window.getByLabel(/Recurring Monthly/).check()
    await shoot(window, '06-expenses-recurring-form')
    await window.getByRole('button', { name: 'Save' }).click()

    await expect(window.getByText(RECURRING_DESC)).toBeVisible({ timeout: 10_000 })
    await shoot(window, '06-expenses-after-recurring-create')
  })
})
