import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, shoot } from '../fixtures/support'

/**
 * Real rendered-UI checks for the deep audit (Sections A/B/C…). Self-contained:
 * own fresh profile + injected offline session (no Firebase).
 */

const SUFFIX = Date.now().toString().slice(-6)

async function authenticate(window: Page): Promise<void> {
  const deviceId = await window.evaluate(() => window.api.auth.getDeviceId())
  await window.evaluate(async (id) => {
    await window.api.auth.saveLocalSession({
      uid: 'qa-e2e-test-uid',
      email: 'qa-e2e@repairdesk.local',
      deviceId: id,
      refreshToken: 'not-real',
      issuedAt: new Date().toISOString()
    })
  }, deviceId)
  await window.reload()
  await window.waitForLoadState('domcontentloaded')
  await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 20_000 })
}

test.describe.serial('Deep audit — UI', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('audit-ui')))
    await authenticate(window)
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('A2: editing a repair price below amount paid shows an overpayment warning', async () => {
    const name = `A2 ${SUFFIX}`
    const model = `A2-${SUFFIX}`
    await window.locator('nav').getByRole('link', { name: /^Repairs/ }).click()
    await window.getByRole('button', { name: 'New Repair Order' }).click()
    const picker = window.locator('form').locator('input[type=text]').first()
    await picker.fill(name)
    await window.getByText('Create New Customer', { exact: false }).click()
    await window.locator('input[type=tel]').first().fill(`03008${SUFFIX}`)
    await window.getByRole('button', { name: 'Save' }).first().click()
    await expect(window.getByText(name)).toBeVisible({ timeout: 5_000 })

    await window.getByLabel(/Device Brand/).fill('Samsung')
    await window.getByLabel(/Device Model/).fill(model)
    await window.locator('textarea').first().fill('E2E A2 overpayment')
    await window.getByLabel(/Total Price/).fill('4500')
    await window.getByLabel(/^Advance Amount/).fill('1000')
    await window.getByRole('button', { name: 'Save' }).click()
    await expect(window.getByText(`Samsung ${model}`)).toBeVisible({ timeout: 10_000 })

    // Edit → lower price below the 1000 already paid.
    await window.getByRole('button', { name: 'Edit' }).click()
    const priceInput = window.getByLabel(/Total Price/)
    await priceInput.fill('500')
    // Warning appears and the Remaining Balance reads negative.
    await expect(window.getByTestId('price-below-paid-warning')).toBeVisible()
    await shoot(window, '23-A2-price-below-paid')

    // Raising it back above paid clears the warning.
    await priceInput.fill('4500')
    await expect(window.getByTestId('price-below-paid-warning')).toHaveCount(0)
  })

  test('D10: a cancelled repair shows a "Cancelled" status in the customer history (not hidden)', async () => {
    const name = `D10 ${SUFFIX}`
    const model = `D10-${SUFFIX}`
    await window.locator('nav').getByRole('link', { name: /^Repairs/ }).click()
    await window.getByRole('button', { name: 'New Repair Order' }).click()
    const picker = window.locator('form').locator('input[type=text]').first()
    await picker.fill(name)
    await window.getByText('Create New Customer', { exact: false }).click()
    await window.locator('input[type=tel]').first().fill(`03010${SUFFIX}`)
    await window.getByRole('button', { name: 'Save' }).first().click()
    await expect(window.getByText(name)).toBeVisible({ timeout: 5_000 })
    await window.getByLabel(/Device Brand/).fill('Nokia')
    await window.getByLabel(/Device Model/).fill(model)
    await window.locator('textarea').first().fill('E2E D10')
    await window.getByLabel(/Total Price/).fill('5000')
    await window.getByLabel(/^Advance Amount/).fill('1000')
    await window.getByRole('button', { name: 'Save' }).click()
    await expect(window.getByText(`Nokia ${model}`)).toBeVisible({ timeout: 10_000 })

    // Cancel it.
    await window.getByRole('button', { name: 'Cancel Order' }).click()
    await window.getByRole('alertdialog').getByRole('button', { name: 'Cancel Order' }).click()
    await expect(window.getByText('Cancelled', { exact: true }).first()).toBeVisible({ timeout: 5_000 })

    // Open the customer profile → repair history row shows the device AND a Cancelled badge.
    await window.getByRole('button', { name: /View Customer Profile/ }).click()
    const row = window.locator('tr', { hasText: model })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Cancelled')
    await shoot(window, '23-D10-customer-history-cancelled')
  })

  test('I23: keyboard Tab flow moves through form fields both ways with no trap', async () => {
    await window.locator('nav').getByRole('link', { name: /^Customers/ }).click()
    await window.getByRole('button', { name: /Add Customer|New Customer/ }).click()
    // Name field autofocuses.
    const activeName = () => window.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name ?? document.activeElement?.tagName ?? '')
    await expect.poll(activeName).toBe('name')

    // Forward: Tab advances to the next field each time (never stuck).
    await window.keyboard.press('Tab')
    await expect.poll(activeName).toBe('phone')
    await window.keyboard.press('Tab')
    await expect.poll(activeName).toBe('address')
    await window.keyboard.press('Tab')
    await expect.poll(activeName).toBe('notes')

    // Backward: Shift+Tab leaves the field it landed on (no trap in either direction).
    await window.keyboard.press('Shift+Tab')
    await expect.poll(activeName).toBe('address')
    await shoot(window, '23-I23-tab-flow')
  })

  test('Flag2: an expense can be edited via the new Edit flow', async () => {
    const desc = `EditExp ${SUFFIX}`
    await window.locator('nav').getByRole('link', { name: /^Expenses/ }).click()
    await window.getByRole('button', { name: 'Add Expense' }).click()
    await window.getByLabel(/^Amount/).fill('750')
    await window.getByLabel(/^Description/).fill(desc)
    await window.getByRole('button', { name: 'Save' }).click()
    await expect(window.getByText(desc)).toBeVisible({ timeout: 10_000 })

    const row = window.locator('tr', { hasText: desc })
    await row.getByRole('button', { name: 'Edit' }).click()
    await expect(window.getByText('Edit Expense', { exact: true })).toBeVisible()
    const amount = window.getByLabel(/^Amount/)
    await amount.fill('999')
    await window.getByRole('button', { name: 'Save' }).click()

    const updatedRow = window.locator('tr', { hasText: desc })
    await expect(updatedRow).toContainText('999.00')
    await expect(updatedRow).not.toContainText('750.00')
    await shoot(window, '23-Flag2-expense-edited')
  })

  test('Flag2: a standalone udhaar entry can be edited (amount changeable)', async () => {
    const person = `UEdit ${SUFFIX}`
    await window.locator('nav').getByRole('link', { name: /^Udhaar/ }).click()
    await window.getByRole('button', { name: 'Add Udhaar' }).click()
    await window.getByRole('button', { name: /Someone Else/ }).click()
    await window.getByLabel(/^Name/).fill(person)
    await window.getByLabel(/^Amount/).fill('3000')
    await window.getByRole('button', { name: 'Save' }).click()
    await expect(window.getByText(person)).toBeVisible({ timeout: 10_000 })

    const row = window.locator('tr', { hasText: person })
    await row.getByRole('button', { name: 'Edit' }).click()
    await expect(window.getByText('Edit Udhaar', { exact: true })).toBeVisible()
    // Standalone entry → amount is editable (not read-only) and has no linked hint.
    await expect(window.getByTestId('linked-udhaar-hint')).toHaveCount(0)
    const amount = window.getByLabel(/^Amount/)
    await expect(amount).toBeEditable()
    await amount.fill('4500')
    await window.getByRole('button', { name: 'Save' }).click()

    const updatedRow = window.locator('tr', { hasText: person })
    await expect(updatedRow).toContainText('4500.00')
    await shoot(window, '23-Flag2-udhaar-edited')
  })

  test('Flag2: a repair-linked udhaar locks its amount (UI + IPC guard)', async () => {
    // Build a linked udhaar through the real IPC: create customer + repair, then
    // Deliver on Credit, which creates a receivable udhaar bound to the repair.
    const linkedUdhaarId = await window.evaluate(async () => {
      const cust = await window.api.customers.create({ name: `Linked ${Date.now()}`, phone: `0307${String(Date.now()).slice(-7)}` })
      const repair = await window.api.repairs.create({
        customerId: cust.id,
        deviceBrand: 'Samsung',
        deviceModel: 'LINKED',
        issue: 'x',
        repairPrice: 4000,
        advanceAmount: 0
      })
      await window.api.repairs.deliverOnCredit({ repairId: repair.id, udhaarAmount: 4000, dueDate: '2026-12-01' })
      const linked = await window.api.udhaar.findByRepairId(repair.id)
      return linked[0].id
    })
    expect(linkedUdhaarId).toBeTruthy()

    // IPC guard: editing the linked amount is rejected even via a direct call.
    const rejected = await window.evaluate(async (id) => {
      try {
        await window.api.udhaar.update(id, { totalAmount: 9999 })
        return false
      } catch {
        return true
      }
    }, linkedUdhaarId)
    expect(rejected).toBe(true)

    // UI: the edit page shows the linked hint and a read-only amount.
    await window.evaluate((id) => {
      window.location.hash = `#/udhaar/${id}/edit`
    }, linkedUdhaarId)
    await expect(window.getByTestId('linked-udhaar-hint')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByLabel(/^Amount/)).not.toBeEditable()
    // Due date + notes remain editable — a real, safe edit still saves.
    await window.getByLabel(/Notes/).fill('linked note edit')
    await window.getByRole('button', { name: 'Save' }).click()
    await expect(window.locator('main').getByText('Total Receivables')).toBeVisible({ timeout: 10_000 })
    await shoot(window, '23-Flag2-udhaar-linked-locked')
  })
})
