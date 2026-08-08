import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, shoot } from '../fixtures/support'

/**
 * Real rendered-UI verification of the new money flows (Parts A/B/C/D):
 * advance-as-payment, Mark-as-Delivered full payment, Deliver-on-Credit
 * (100/50/custom), Udhaar settlement (incl. the "Full" quick option) becoming
 * a repair payment, and the Payments-page "N of M" indicator. Self-contained:
 * uses its own fresh profile and an injected offline session (no Firebase),
 * mirroring scripts/e2e-setup-session.js.
 */

const SUFFIX = Date.now().toString().slice(-6)
const inputByLabel = (window: Page, label: RegExp) => window.getByLabel(label)

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

/** Creates a brand-new customer + repair through the UI, landing on the repair detail page. */
async function createRepair(
  window: Page,
  opts: { name: string; phone: string; brand: string; model: string; price: string; advance?: string }
): Promise<void> {
  await window.locator('nav').getByRole('link', { name: /^Repairs/ }).click()
  await window.getByRole('button', { name: 'New Repair Order' }).click()
  await expect(window.getByText('New Repair Order', { exact: true })).toBeVisible()

  const picker = window.locator('form').locator('input[type=text]').first()
  await picker.fill(opts.name)
  await window.getByText('Create New Customer', { exact: false }).click()
  await window.locator('input[type=tel]').first().fill(opts.phone)
  await window.getByRole('button', { name: 'Save' }).first().click()
  await expect(window.getByText(opts.name)).toBeVisible({ timeout: 5_000 })

  await inputByLabel(window, /Device Brand/).fill(opts.brand)
  await inputByLabel(window, /Device Model/).fill(opts.model)
  await window.locator('textarea').first().fill('E2E cracked screen')
  await inputByLabel(window, /Total Price/).fill(opts.price)
  if (opts.advance) await inputByLabel(window, /Advance Amount/).fill(opts.advance)

  await window.getByRole('button', { name: 'Save' }).click()
  // The device header ("<brand> <model>") is the unambiguous landing marker.
  await expect(window.getByText(`${opts.brand} ${opts.model}`)).toBeVisible({ timeout: 10_000 })
}

async function markCompleted(window: Page): Promise<void> {
  await window.getByRole('button', { name: /Mark as Completed/ }).click()
  await expect(window.getByText('Completed', { exact: true }).first()).toBeVisible({ timeout: 5_000 })
}

async function todayRevenue(window: Page): Promise<number> {
  return window.evaluate(() => window.api.dashboard.getSummary().then((s) => s.todayRevenue))
}

test.describe.serial('New delivery / credit / settlement flows', () => {
  let app: ElectronApplication
  let window: Page

  const CUST = {
    advance: { name: `Adv ${SUFFIX}`, phone: `0300${SUFFIX}` },
    full: { name: `Full ${SUFFIX}`, phone: `0301${SUFFIX}` },
    c100: { name: `C100 ${SUFFIX}`, phone: `0302${SUFFIX}` },
    c50: { name: `C50 ${SUFFIX}`, phone: `0303${SUFFIX}` },
    ccustom: { name: `CCust ${SUFFIX}`, phone: `0304${SUFFIX}` }
  }

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('delivery-flows')))
    await authenticate(window)
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('1. advance at booking becomes a Payment and counts toward Revenue immediately', async () => {
    await createRepair(window, { ...CUST.advance, brand: 'Samsung', model: `ADV-${SUFFIX}`, price: '3000', advance: '1500' })

    // Ledger shows the advance payment.
    await window.locator('nav').getByRole('link', { name: /^Payments/ }).click()
    const advRow = window.locator('tr', { hasText: CUST.advance.name })
    await expect(advRow).toContainText('Advance')
    await expect(advRow).toContainText('1500.00')

    // Revenue reflects it right away (fresh profile → exactly 1500 so far).
    expect(await todayRevenue(window)).toBeCloseTo(1500, 2)
    await shoot(window, '10-01-advance-in-ledger')
  })

  test('2. Mark as Delivered auto-records the full remaining balance and delivers', async () => {
    await createRepair(window, { ...CUST.full, brand: 'Apple', model: `FULL-${SUFFIX}`, price: '2222' })
    await markCompleted(window)

    await window.getByRole('button', { name: /Mark as Delivered/ }).click()
    await expect(window.getByText('Delivered', { exact: true }).first()).toBeVisible({ timeout: 5_000 })
    // Remaining balance card now 0.
    await expect(window.getByText('0.00').first()).toBeVisible()

    await window.locator('nav').getByRole('link', { name: /^Payments/ }).click()
    const row = window.locator('tr', { hasText: CUST.full.name })
    await expect(row).toContainText('Full')
    await expect(row).toContainText('2222.00')

    expect(await todayRevenue(window)).toBeCloseTo(1500 + 2222, 2)
    await shoot(window, '10-02-full-delivery')
  })

  test('3a. Deliver on Credit — 100% (all on credit, input locks, no payment)', async () => {
    await createRepair(window, { ...CUST.c100, brand: 'Oppo', model: `C100-${SUFFIX}`, price: '1111' })
    await markCompleted(window)

    await window.getByRole('button', { name: /Deliver on Credit/ }).click()
    await window.getByRole('button', { name: /100%/ }).click()
    // Input is locked to the full remaining balance.
    const amountInput = window.getByLabel(/Amount on Credit/)
    await expect(amountInput).toBeDisabled()
    await expect(amountInput).toHaveValue('1111')
    await window.getByRole('button', { name: /Confirm & Deliver/ }).click()

    await expect(window.getByText('Delivered', { exact: true }).first()).toBeVisible({ timeout: 5_000 })
    // No new payment → revenue unchanged from previous test.
    expect(await todayRevenue(window)).toBeCloseTo(1500 + 2222, 2)

    // A receivable udhaar of 1111 exists for this customer.
    await window.locator('nav').getByRole('link', { name: /^Udhaar/ }).click()
    const uRow = window.locator('tr', { hasText: CUST.c100.name })
    await expect(uRow).toContainText('1111.00')
    await shoot(window, '10-03a-credit-100')
  })

  test('3b. Deliver on Credit — 50% (half paid, half on credit)', async () => {
    await createRepair(window, { ...CUST.c50, brand: 'Vivo', model: `C50-${SUFFIX}`, price: '4000' })
    await markCompleted(window)

    await window.getByRole('button', { name: /Deliver on Credit/ }).click()
    await window.getByRole('button', { name: /50%/ }).click()
    await expect(window.getByLabel(/Amount on Credit/)).toHaveValue('2000')
    await window.getByRole('button', { name: /Confirm & Deliver/ }).click()
    await expect(window.getByText('Delivered', { exact: true }).first()).toBeVisible({ timeout: 5_000 })

    // 2000 paid now → revenue up by 2000.
    expect(await todayRevenue(window)).toBeCloseTo(1500 + 2222 + 2000, 2)

    await window.locator('nav').getByRole('link', { name: /^Payments/ }).click()
    await expect(window.locator('tr', { hasText: CUST.c50.name })).toContainText('2000.00')
    await window.locator('nav').getByRole('link', { name: /^Udhaar/ }).click()
    await expect(window.locator('tr', { hasText: CUST.c50.name })).toContainText('2000.00')
    await shoot(window, '10-03b-credit-50')
  })

  test('3c. Deliver on Credit — custom split (3200 on credit, 1800 paid)', async () => {
    await createRepair(window, { ...CUST.ccustom, brand: 'Realme', model: `CCUST-${SUFFIX}`, price: '5000' })
    await markCompleted(window)

    await window.getByRole('button', { name: /Deliver on Credit/ }).click()
    await window.getByLabel(/Amount on Credit/).fill('3200')
    await window.getByRole('button', { name: /Confirm & Deliver/ }).click()
    await expect(window.getByText('Delivered', { exact: true }).first()).toBeVisible({ timeout: 5_000 })

    // 1800 paid now.
    expect(await todayRevenue(window)).toBeCloseTo(1500 + 2222 + 2000 + 1800, 2)
    await window.locator('nav').getByRole('link', { name: /^Payments/ }).click()
    await expect(window.locator('tr', { hasText: CUST.ccustom.name })).toContainText('1800.00')
    await shoot(window, '10-03c-credit-custom')
  })

  test('4 + 5. Settling the credit Udhaar with the "Full" quick option adds Revenue at that point', async () => {
    const before = await todayRevenue(window)

    await window.locator('nav').getByRole('link', { name: /^Udhaar/ }).click()
    const uRow = window.locator('tr', { hasText: CUST.ccustom.name })
    await expect(uRow).toContainText('3200.00')
    await uRow.getByRole('button', { name: /Record Settlement/ }).click()

    // "Full" quick option locks the input at the full remaining balance.
    await window.getByRole('button', { name: 'Full', exact: true }).click()
    const amount = window.getByLabel('Settlement Amount', { exact: true })
    await expect(amount).toBeDisabled()
    await expect(amount).toHaveValue('3200')
    await window.getByRole('button', { name: /Save/ }).click()

    // Revenue only now goes up by 3200 (not before settlement).
    await expect.poll(() => todayRevenue(window)).toBeCloseTo(before + 3200, 2)
    await shoot(window, '10-04-settlement-full')
  })

  test('6. Payments page shows the "N of M" indicator for a multi-payment repair', async () => {
    await window.locator('nav').getByRole('link', { name: /^Payments/ }).click()
    // The custom-credit repair now has 2 payments: 1800 partial + 3200 settlement.
    const rows = window.locator('tr', { hasText: CUST.ccustom.name })
    await expect(rows.first()).toContainText('of 2 payments')
    await expect(rows).toHaveCount(2)
    await shoot(window, '10-06-n-of-m-indicator')
  })
})
