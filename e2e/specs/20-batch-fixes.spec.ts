import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, authenticateOffline, shoot } from '../fixtures/support'

/**
 * Follow-up batch: (1) Report PDF completeness (print stylesheet lifts the
 * shell's clipping so a multi-section report isn't truncated), (2) Udhaar
 * "Extend Due Date" rejects past / non-extending dates, (3) issue quick-chips
 * are multi-select and combine into the Issue field — in both the main repair
 * form and POS Mode.
 */

const SUFFIX = Date.now().toString().slice(-6)

function isoOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test.describe.serial('Batch fixes: report / extend-date / multi-chips', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('batch-fixes')))
    await authenticateOffline(window)
    await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 20_000 })
    // Seed some report-worthy data dated today so the monthly report has rows.
    await window.evaluate(async (suffix) => {
      const c = await window.api.customers.create({ name: `Rep Cust ${suffix}`, phone: `03031${suffix}` })
      const r = await window.api.repairs.create({ customerId: c.id, deviceBrand: 'Samsung', deviceModel: `RPT-${suffix}`, issue: 'Screen Replacement', repairPrice: 5000, costPrice: 2000 })
      await window.api.repairs.update(r.id, { status: 'completed' })
      await window.api.repairs.deliverWithFullPayment(r.id)
      await window.api.expenses.create({ category: 'rent', amount: 1000, description: null, expenseDate: new Date().toISOString().slice(0, 10), isRecurring: false, recurringMonth: null })
    }, SUFFIX)
  })

  test.afterAll(async () => {
    await window.emulateMedia({ media: null }).catch(() => {})
    await app.close()
  })

  test('Report shows all sections, and print media lifts the shell clipping so nothing is truncated', async () => {
    await window.locator('nav').getByRole('link', { name: /^Reports/ }).click()
    // Default period is monthly — the report card renders every section.
    for (const heading of ['Expenses by Category', 'Top Brands', 'Top Models', 'Common Repair Types', 'Repairs by Status']) {
      await expect(window.getByText(heading, { exact: true })).toBeVisible()
    }

    // The actual truncation fix: under print media, the full-height/overflow-hidden
    // shell containers must become visible/auto so a long report flows onto more
    // pages instead of being clipped to one viewport.
    await window.emulateMedia({ media: 'print' })
    const styles = await window.evaluate(() => {
      const shellOverflows = Array.from(document.querySelectorAll('.app-shell')).map(
        (el) => getComputedStyle(el).overflow
      )
      const main = document.querySelector('main')
      return { shellOverflows, mainOverflow: main ? getComputedStyle(main).overflow : null }
    })
    expect(styles.shellOverflows.length).toBeGreaterThanOrEqual(2)
    expect(styles.shellOverflows.every((o) => o === 'visible')).toBe(true)
    expect(styles.mainOverflow).toBe('visible')
    await shoot(window, '20-report-print-media')
    await window.emulateMedia({ media: null })
  })

  test('Extend Due Date blocks a past date and a non-extending date, allows a later one', async () => {
    // A receivable due 30 days out.
    const dueDate = isoOffset(30)
    await window.evaluate(
      async ({ suffix, dueDate }) => {
        await window.api.udhaar.create({ personName: `Extend Guy ${suffix}`, personPhone: null, customerId: null, direction: 'receivable', totalAmount: 500, dueDate, notes: null })
      },
      { suffix: SUFFIX, dueDate }
    )

    await window.locator('nav').getByRole('link', { name: /^Udhaar/ }).click()
    await expect(window.getByText(`Extend Guy ${SUFFIX}`)).toBeVisible({ timeout: 10_000 })
    await window.getByRole('button', { name: /Extend Due Date/ }).first().click()

    const dateInput = window.locator('input[type=date]').first()
    const confirm = window.getByRole('button', { name: /Update Date/ })

    // Past date → blocked.
    await dateInput.fill(isoOffset(-2))
    await expect(window.getByTestId('extend-date-error')).toBeVisible()
    await expect(confirm).toBeDisabled()

    // A date before the current due date (today) → non-extending, still blocked.
    await dateInput.fill(isoOffset(0))
    await expect(window.getByTestId('extend-date-error')).toBeVisible()
    await expect(confirm).toBeDisabled()
    await shoot(window, '20-extend-date-blocked')

    // A date after the current due date → allowed.
    await dateInput.fill(isoOffset(45))
    await expect(window.getByTestId('extend-date-error')).toHaveCount(0)
    await expect(confirm).toBeEnabled()
    await confirm.click()
    // Control closed on success.
    await expect(window.getByTestId('extend-date-error')).toHaveCount(0)
  })

  async function assertMultiChips(win: Page): Promise<void> {
    const issue = win.locator('textarea').first()
    // Toggle two chips on → combined, comma-separated.
    await win.getByRole('button', { name: /Screen Replacement/ }).click()
    await expect(issue).toHaveValue('Screen Replacement')
    await win.getByRole('button', { name: /Battery Replacement/ }).click()
    await expect(issue).toHaveValue('Screen Replacement, Battery Replacement')
    // Toggle the first back off → only the second remains.
    await win.getByRole('button', { name: /Screen Replacement/ }).click()
    await expect(issue).toHaveValue('Battery Replacement')
  }

  test('Issue chips multi-select and combine — main repair form', async () => {
    await window.locator('nav').getByRole('link', { name: /^Repairs/ }).click()
    await window.getByRole('button', { name: 'New Repair Order' }).click()
    await expect(window.getByText('New Repair Order', { exact: true })).toBeVisible()
    await assertMultiChips(window)
    await shoot(window, '20-chips-main-form')
  })

  test('Issue chips multi-select and combine — POS Mode', async () => {
    await window.locator('nav').getByRole('link', { name: /^Dashboard/ }).click()
    await window.getByRole('button', { name: /Switch to POS Mode/ }).click()
    await expect(window.getByText('POS Mode', { exact: true })).toBeVisible()
    await assertMultiChips(window)
    await shoot(window, '20-chips-pos')
    await window.getByRole('button', { name: /Switch to Dashboard/ }).click()
  })
})
