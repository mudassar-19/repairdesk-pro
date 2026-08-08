import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, authenticateOffline, shoot } from '../fixtures/support'

/**
 * Part I — POS Mode. Real rendered-UI verification of the fast one-screen order
 * flow and its three "how is this order leaving?" paths (pending, delivered
 * paid-in-full, delivered on credit), each ending in the reused receipt and a
 * clean reset.
 */

const SUFFIX = Date.now().toString().slice(-6)

async function posCreateCustomerAndDevice(
  window: Page,
  o: { name: string; phone: string; brand: string; model: string; price: string; advance?: string }
): Promise<void> {
  const picker = window.locator('input[type=text]').first()
  await picker.fill(o.name)
  await window.getByText('Create New Customer', { exact: false }).click()
  await window.locator('input[type=tel]').first().fill(o.phone)
  await window.getByRole('button', { name: /Save/ }).first().click()
  await expect(window.getByText(o.name).first()).toBeVisible({ timeout: 5_000 })

  await window.getByLabel(/Device Brand/).fill(o.brand)
  await window.getByLabel(/Device Model/).fill(o.model)
  await window.locator('textarea').first().fill('E2E POS order')
  await window.getByLabel(/Total Price/).fill(o.price)
  if (o.advance) await window.getByLabel(/Advance Amount/).fill(o.advance)
}

function repairByModel(window: Page, model: string) {
  return window.evaluate(async (model) => {
    const repairs = await window.api.repairs.list()
    const repair = repairs.find((r) => r.deviceModel === model)
    if (!repair) return null
    const payments = await window.api.payments.findByRepairId(repair.id)
    const udhaar = await window.api.udhaar.findByRepairId(repair.id)
    return { repair, payments, udhaar }
  }, model)
}

test.describe.serial('POS Mode (Part I)', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('pos')))
    await authenticateOffline(window)
    await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 20_000 })
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('toggles into a focused POS screen with no sidebar browsing', async () => {
    await window.getByRole('button', { name: /Switch to POS Mode/ }).click()
    await expect(window.getByText('POS Mode', { exact: true })).toBeVisible()
    await expect(window.getByRole('button', { name: /Switch to Dashboard/ })).toBeVisible()
    // None of the browsing surfaces are present in POS mode.
    await expect(window.getByRole('link', { name: /Reports/ })).toHaveCount(0)
    await expect(window.getByRole('link', { name: /Analytics/ })).toHaveCount(0)
    await shoot(window, '15-pos-screen')
  })

  test('POS parity: issue quick-chips fill the field and Enter advances between fields', async () => {
    // J14 chips work on the POS screen too.
    await window.getByRole('button', { name: /Charging Port/ }).click()
    await expect(window.locator('textarea').first()).toHaveValue('Charging Port')

    // J15 keyboard flow: Enter in Device Brand advances to Device Model.
    const brand = window.getByLabel(/Device Brand/)
    await brand.click()
    await brand.fill('Nokia')
    await window.keyboard.press('Enter')
    const activeName = await window.evaluate(() => document.activeElement?.getAttribute('name'))
    expect(activeName).toBe('deviceModel')
  })

  test('pending order: creates + prints receipt + resets', async () => {
    const model = `POS-PEND-${SUFFIX}`
    await posCreateCustomerAndDevice(window, {
      name: `POS Pend ${SUFFIX}`,
      phone: `0300${SUFFIX}`,
      brand: 'Nokia',
      model,
      price: '2000',
      advance: '500'
    })
    await window.getByRole('button', { name: /In for repair/ }).click()
    await window.getByRole('button', { name: /Save & Print/ }).click()

    // Reused receipt template appears; close it → form resets for next customer.
    await expect(window.getByRole('button', { name: /Export PDF/ })).toBeVisible({ timeout: 5_000 })
    await window.getByRole('button', { name: /Close/ }).click()
    await expect(window.getByText(dictionaryReadyText())).toBeVisible()

    const data = await repairByModel(window, model)
    expect(data?.repair.status).toBe('pending')
    // Advance (500) is a real advance payment; remaining = 2000 - 500.
    expect(data?.payments.length).toBe(1)
    expect(data?.payments[0].type).toBe('advance')
    expect(data?.repair.remainingBalance).toBeCloseTo(1500, 2)
  })

  test('delivered-paid order: creates + full payment + delivered', async () => {
    const model = `POS-PAID-${SUFFIX}`
    await posCreateCustomerAndDevice(window, {
      name: `POS Paid ${SUFFIX}`,
      phone: `0301${SUFFIX}`,
      brand: 'Apple',
      model,
      price: '3000'
    })
    await window.getByRole('button', { name: /Paid in full/ }).click()
    await window.getByRole('button', { name: /Save & Print/ }).click()
    await expect(window.getByRole('button', { name: /Export PDF/ })).toBeVisible({ timeout: 5_000 })
    await window.getByRole('button', { name: /Close/ }).click()

    const data = await repairByModel(window, model)
    expect(data?.repair.status).toBe('delivered')
    expect(data?.repair.remainingBalance).toBeCloseTo(0, 2)
    expect(data?.payments.some((p) => p.type === 'full' && Math.abs(p.amount - 3000) < 0.01)).toBe(true)
  })

  test('on-credit order: creates + split modal + linked udhaar + delivered', async () => {
    const model = `POS-CRED-${SUFFIX}`
    await posCreateCustomerAndDevice(window, {
      name: `POS Cred ${SUFFIX}`,
      phone: `0302${SUFFIX}`,
      brand: 'Realme',
      model,
      price: '4000'
    })
    await window.getByRole('button', { name: /On credit/ }).click()
    await window.getByRole('button', { name: /Save & Print/ }).click()

    // The Deliver-on-Credit split modal opens before the receipt.
    await window.getByRole('button', { name: /50%/ }).click()
    await expect(window.getByLabel(/Amount on Credit/)).toHaveValue('2000')
    await window.getByRole('button', { name: /Confirm & Deliver/ }).click()

    // Then the receipt.
    await expect(window.getByRole('button', { name: /Export PDF/ })).toBeVisible({ timeout: 5_000 })
    await window.getByRole('button', { name: /Close/ }).click()

    const data = await repairByModel(window, model)
    expect(data?.repair.status).toBe('delivered')
    expect(data?.payments.some((p) => p.type === 'partial' && Math.abs(p.amount - 2000) < 0.01)).toBe(true)
    expect(data?.udhaar.some((u) => u.direction === 'receivable' && Math.abs(u.totalAmount - 2000) < 0.01)).toBe(true)
    await shoot(window, '15-pos-credit-done')
  })

  test('returns to the Dashboard', async () => {
    await window.getByRole('button', { name: /Switch to Dashboard/ }).click()
    await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 10_000 })
  })
})

/** The bilingual "ready for next" note renders its English line as this text. */
function dictionaryReadyText(): string {
  return 'Order saved. Ready for the next customer.'
}
