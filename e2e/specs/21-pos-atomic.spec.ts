import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, authenticateOffline, shoot } from '../fixtures/support'

/**
 * POS take-now flows must be ALL-OR-NOTHING. Previously the repair was created
 * as soon as the credit-split modal opened, so cancelling that modal left an
 * orphaned pending repair with no payment/udhaar. Now nothing is written until
 * the modal is confirmed (create + payment + udhaar in one transaction), and
 * "Paid in full" likewise creates + pays + delivers atomically.
 */

const SUFFIX = Date.now().toString().slice(-6)

async function enterPos(window: Page): Promise<void> {
  await window.locator('nav').getByRole('link', { name: /^Dashboard/ }).click().catch(() => {})
  await window.getByRole('button', { name: /Switch to POS Mode/ }).click()
  await expect(window.getByText('POS Mode', { exact: true })).toBeVisible()
}

async function selectExistingCustomer(window: Page, name: string): Promise<void> {
  const picker = window.locator('input[type=text]').first()
  await picker.fill(name)
  await window.getByText(name, { exact: false }).first().click()
}

async function fillDevice(window: Page, opts: { model: string; price: string }): Promise<void> {
  await window.getByLabel(/Device Brand/).fill('Oppo')
  await window.getByLabel(/Device Model/).fill(opts.model)
  await window.locator('textarea').first().fill('atomicity test')
  await window.getByLabel(/Total Price/).fill(opts.price)
}

function repairsForCustomer(window: Page, customerId: string) {
  return window.evaluate(async (id) => {
    const repairs = await window.api.repairs.list({ customerId: id })
    const detail = await Promise.all(
      repairs.map(async (r) => ({
        repair: r,
        payments: await window.api.payments.findByRepairId(r.id),
        udhaar: await window.api.udhaar.findByRepairId(r.id)
      }))
    )
    return detail
  }, customerId)
}

test.describe.serial('POS take-now flows are atomic', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('pos-atomic')))
    await authenticateOffline(window)
    await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 20_000 })
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('On credit: cancelling the split modal creates NOTHING; confirming then creates everything atomically', async () => {
    const cust = await window.evaluate(
      (s) => window.api.customers.create({ name: `Atomic Cred ${s}`, phone: `03040${s}` }),
      SUFFIX
    )
    const model = `ATOMIC-CRED-${SUFFIX}`

    await enterPos(window)
    await selectExistingCustomer(window, `Atomic Cred ${SUFFIX}`)
    await fillDevice(window, { model, price: '4000' })

    await window.getByRole('button', { name: /On credit/ }).click()
    await window.getByRole('button', { name: /Save & Print/ }).click()

    // The split modal is open — but nothing has been written yet.
    await expect(window.getByRole('button', { name: /Confirm & Deliver/ })).toBeVisible()

    // CANCEL the modal.
    await window.getByRole('button', { name: /Cancel/ }).click()
    await expect(window.getByRole('button', { name: /Confirm & Deliver/ })).toHaveCount(0)
    await shoot(window, '21-credit-cancelled')

    // Nothing was created: no repair (hence no payment/udhaar) for this customer.
    let state = await repairsForCustomer(window, cust.id)
    expect(state.length).toBe(0)

    // The form is still filled — confirm this time creates everything atomically.
    await window.getByRole('button', { name: /Save & Print/ }).click()
    await window.getByRole('button', { name: /50%/ }).click()
    await window.getByRole('button', { name: /Confirm & Deliver/ }).click()
    await expect(window.getByRole('button', { name: /Export PDF/ })).toBeVisible({ timeout: 5_000 })
    await window.getByRole('button', { name: /Close/ }).click()

    state = await repairsForCustomer(window, cust.id)
    expect(state.length).toBe(1)
    const entry = state[0]
    expect(entry.repair.status).toBe('delivered')
    expect(entry.payments.some((p) => p.type === 'partial' && Math.abs(p.amount - 2000) < 0.01)).toBe(true)
    expect(entry.udhaar.some((u) => u.direction === 'receivable' && Math.abs(u.totalAmount - 2000) < 0.01)).toBe(true)
  })

  test('Paid in full: one action creates the repair + full payment + delivered atomically', async () => {
    const cust = await window.evaluate(
      (s) => window.api.customers.create({ name: `Atomic Paid ${s}`, phone: `03041${s}` }),
      SUFFIX
    )
    const model = `ATOMIC-PAID-${SUFFIX}`

    await selectExistingCustomer(window, `Atomic Paid ${SUFFIX}`)
    await fillDevice(window, { model, price: '3000' })

    await window.getByRole('button', { name: /Paid in full/ }).click()
    await window.getByRole('button', { name: /Save & Print/ }).click()
    // No split modal for paid-in-full — straight to the receipt.
    await expect(window.getByRole('button', { name: /Export PDF/ })).toBeVisible({ timeout: 5_000 })
    await window.getByRole('button', { name: /Close/ }).click()

    const state = await repairsForCustomer(window, cust.id)
    expect(state.length).toBe(1)
    const entry = state[0]
    expect(entry.repair.status).toBe('delivered')
    expect(entry.repair.remainingBalance).toBe(0)
    expect(entry.payments.some((p) => p.type === 'full' && Math.abs(p.amount - 3000) < 0.01)).toBe(true)
    await shoot(window, '21-paid-in-full')
  })
})
