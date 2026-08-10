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
    // Category options are bilingual now — select the Custom option by value.
    await window.locator('select').first().selectOption('__custom__')
    await window.getByLabel(/^Custom Category Name/).fill('E2E Custom Category')
    await window.getByLabel(/^Amount/).fill('300')
    await window.getByLabel(/^Description/).fill(RECURRING_DESC)
    // "Recurring Monthly" was simplified to a plain "Repeats every month" toggle.
    await window.getByLabel(/Repeats every month/).check()
    await shoot(window, '06-expenses-recurring-form')
    await window.getByRole('button', { name: 'Save' }).click()

    await expect(window.getByText(RECURRING_DESC)).toBeVisible({ timeout: 10_000 })
    await shoot(window, '06-expenses-after-recurring-create')
  })

  test('deletes an expense via the newly-wired Delete action', async () => {
    // Target the uniquely-named recurring expense (the plain one is a substring
    // of it, so matching on DESCRIPTION alone would be ambiguous).
    const RECURRING_DESC = `${DESCRIPTION} Recurring`
    const row = window.locator('tr', { hasText: RECURRING_DESC })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Delete' }).click()
    // Confirm in the dialog (its confirm button is also "Delete").
    await window.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    // The row disappears (list refreshes via the data bus)…
    await expect(window.locator('tr', { hasText: RECURRING_DESC })).toHaveCount(0, { timeout: 10_000 })
    // …while the other expense is untouched.
    await expect(window.getByText(DESCRIPTION).first()).toBeVisible()
    await shoot(window, '06-expenses-after-delete')
  })
})
