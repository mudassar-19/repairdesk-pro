import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, authenticateOffline, shoot } from '../fixtures/support'

/** Part J/K — UI polish, verified through the real rendered UI. */

test.describe.serial('UX polish (Parts J & K)', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('ux-polish')))
    await authenticateOffline(window)
    await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 20_000 })
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('J14/J17: repair form has issue quick-chips and a soft cost-price note', async () => {
    await window.locator('nav').getByRole('link', { name: /^Repairs/ }).click()
    await window.getByRole('button', { name: 'New Repair Order' }).click()

    // J17: cost note visible while cost is empty (non-blocking).
    await expect(window.getByText(/Cost Price not entered/)).toBeVisible()

    // J14: tapping a chip fills the free-text issue field.
    await window.getByRole('button', { name: /Battery Replacement/ }).click()
    await expect(window.locator('textarea').first()).toHaveValue('Battery Replacement')

    // Note disappears once a cost is entered.
    await window.getByLabel(/Cost Price/).fill('500')
    await expect(window.getByText(/Cost Price not entered/)).toHaveCount(0)
    await shoot(window, '16-repair-chips-costnote')
  })

  test('K19/K20: expense categories are bilingual and there is no month field', async () => {
    await window.locator('nav').getByRole('link', { name: /^Expenses/ }).click()
    await window.getByRole('button', { name: 'Add Expense' }).click()

    // K19: category <option>s carry both English and Urdu.
    const optionTexts = await window.evaluate(() => {
      const select = document.querySelector('form select') as HTMLSelectElement
      return Array.from(select.options).map((o) => o.text)
    })
    expect(optionTexts.some((t) => /Rent/.test(t) && /—/.test(t) && /کرایہ/.test(t))).toBe(true)

    // K20: recurring is a plain monthly toggle — no "Recurring Month" field, even when checked.
    await expect(window.getByText(/Repeats every month/)).toBeVisible()
    await window.locator('input[type=checkbox]').first().check()
    await expect(window.locator('input[type=month]')).toHaveCount(0)
    await expect(window.getByText('Recurring Month')).toHaveCount(0)
  })

  test('J16: a recurring category not logged this month appears as a one-tap pre-filled draft', async () => {
    // Seed last month's recurring rent through the real API.
    await window.evaluate(async () => {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`
      await window.api.expenses.create({
        category: 'rent',
        amount: 15000,
        description: null,
        expenseDate: date,
        isRecurring: true,
        recurringMonth: null
      })
    })

    const drafts = await window.evaluate(() => window.api.expenses.getRecurringDrafts())
    expect(drafts).toEqual([{ category: 'rent', amount: 15000 }])

    // The Dashboard offers it with a one-tap Add.
    await window.locator('nav').getByRole('link', { name: /^Dashboard/ }).click()
    const banner = window.getByTestId('recurring-reminder-banner')
    await expect(banner).toContainText('Rent')
    await expect(banner).toContainText('15000.00')
    await banner.getByRole('button', { name: /Add/ }).click()

    // Lands on a pre-filled expense form (amount + recurring on).
    await expect(window.getByLabel(/Amount/)).toHaveValue('15000')
    await expect(window.locator('input[type=checkbox]').first()).toBeChecked()
    await shoot(window, '16-recurring-draft-prefill')
  })

  test('J15: Enter advances to the next field on the customer form', async () => {
    await window.locator('nav').getByRole('link', { name: /^Customers/ }).click()
    await window.getByRole('button', { name: 'Add Customer' }).click()

    const name = window.locator('input[type=text]').first()
    await name.click()
    await name.fill('Keyboard Flow Test')
    await window.keyboard.press('Enter')

    // Focus moved to the phone field, and the form did NOT submit (still on the form).
    const activeType = await window.evaluate(() => document.activeElement?.getAttribute('type'))
    expect(activeType).toBe('tel')
  })
})
