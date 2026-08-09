import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, freshProfileDir, authenticateOffline, shoot } from '../fixtures/support'

/**
 * Strict input validation + financial/logical guards, verified through the real
 * running UI and the real IPC layer:
 *   • Phone: 11 digits, "03…", rejected as typed (form) + enforced at IPC.
 *   • IMEI: digits only (form + IPC).
 *   • Advance must not exceed Total Price (hard block: form + IPC).
 *   • Cost > Price: soft, visible warning (never blocks).
 *   • New order's Estimated Delivery Date can't be in the past (form).
 *   • POS conditional fields (date/priority hidden for take-now orders).
 *   • Default newest-first sort for Repairs and Customers.
 */

// 6 digits so a 5-char "03NNN" prefix + SUFFIX is exactly an 11-digit number.
const SUFFIX = Date.now().toString().slice(-6)

function yesterdayIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function openNewRepairForm(window: Page): Promise<void> {
  await window.locator('nav').getByRole('link', { name: /^Repairs/ }).click()
  await window.getByRole('button', { name: 'New Repair Order' }).click()
  await expect(window.getByText('New Repair Order', { exact: true })).toBeVisible()
}

async function createCustomerInPicker(window: Page, name: string, phone: string): Promise<void> {
  const picker = window.locator('form').locator('input[type=text]').first()
  await picker.fill(name)
  await window.getByText('Create New Customer', { exact: false }).click()
  await window.locator('input[type=tel]').first().fill(phone)
  await window.getByRole('button', { name: 'Save' }).first().click()
  await expect(window.getByText(name).first()).toBeVisible({ timeout: 5_000 })
}

test.describe.serial('Validation & financial guards', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(freshProfileDir('validation')))
    await authenticateOffline(window)
    await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 20_000 })
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('Phone: invalid characters are rejected as typed, and a short number blocks save', async () => {
    await window.locator('nav').getByRole('link', { name: /^Customers/ }).click()
    await window.getByRole('button', { name: 'Add Customer' }).click()
    await window.locator('input[type=text]').first().fill(`Phone Test ${SUFFIX}`)

    const phone = window.locator('input[type=tel]')
    // Letters/dashes never make it into the field — digits only, capped at 11.
    await phone.fill('03ab00-123456789')
    await expect(phone).toHaveValue('03001234567')

    // A 10-digit number is rejected on save (hard rule: 11 digits, starts 03).
    await phone.fill('0300123456')
    await window.getByRole('button', { name: 'Save' }).click()
    await expect(window.getByText(/11-digit mobile number starting with 03/)).toBeVisible()
    await shoot(window, '19-phone-invalid')

    // A valid number saves.
    await phone.fill(`03007${SUFFIX}`)
    await window.getByRole('button', { name: 'Save' }).click()
    await expect(window.getByText(`Phone Test ${SUFFIX}`).first()).toBeVisible({ timeout: 10_000 })
  })

  test('IMEI accepts digits only (letters rejected as typed)', async () => {
    await openNewRepairForm(window)
    await createCustomerInPicker(window, `IMEI Cust ${SUFFIX}`, `03008${SUFFIX}`)

    const imei = window.getByLabel(/IMEI/)
    await imei.fill('12ab34cd56')
    await expect(imei).toHaveValue('123456')
  })

  test('Advance exceeding Total Price hard-blocks the save', async () => {
    await openNewRepairForm(window)
    await createCustomerInPicker(window, `Adv Cust ${SUFFIX}`, `03009${SUFFIX}`)

    await window.getByLabel(/Device Brand/).fill('Samsung')
    await window.getByLabel(/Device Model/).fill(`ADV-${SUFFIX}`)
    await window.locator('textarea').first().fill('advance guard test')
    await window.getByLabel(/Total Price/).fill('3000')
    await window.getByLabel(/^Advance Amount/).fill('5000')
    await window.getByRole('button', { name: 'Save' }).click()

    await expect(window.getByText(/Advance cannot exceed the Total Price/)).toBeVisible()
    // Still on the form (not navigated to a detail page).
    await expect(window.getByText('New Repair Order', { exact: true })).toBeVisible()
    await shoot(window, '19-advance-exceeds')
  })

  test('Cost Price above Total Price shows a soft warning but still saves', async () => {
    // Continue on the same form; fix the advance, set cost > price.
    await window.getByLabel(/^Advance Amount/).fill('0')
    await window.getByLabel(/^Cost Price/).fill('3000')
    await window.getByLabel(/Total Price/).fill('1000')
    await expect(window.getByTestId('cost-exceeds-price-warning')).toBeVisible()
    await shoot(window, '19-cost-exceeds-warning')

    // Deliberately saving at a loss is allowed.
    await window.getByRole('button', { name: 'Save' }).click()
    await expect(window.getByText(`ADV-${SUFFIX}`).first()).toBeVisible({ timeout: 10_000 })
  })

  test('New order rejects a past Estimated Delivery Date', async () => {
    await openNewRepairForm(window)
    await createCustomerInPicker(window, `Date Cust ${SUFFIX}`, `03010${SUFFIX}`)

    await window.getByLabel(/Device Brand/).fill('Nokia')
    await window.getByLabel(/Device Model/).fill(`DATE-${SUFFIX}`)
    await window.locator('textarea').first().fill('past date test')
    await window.getByLabel(/Total Price/).fill('2000')
    await window.getByLabel(/Estimated Delivery Date/).fill(yesterdayIso())
    await window.getByRole('button', { name: 'Save' }).click()

    await expect(window.getByText(/Delivery date cannot be in the past/)).toBeVisible()
    await shoot(window, '19-past-date')
  })

  test('POS New Order hides Date & Priority for take-now orders, shows them for pending', async () => {
    await window.locator('nav').getByRole('link', { name: /^Dashboard/ }).click()
    await window.getByRole('button', { name: /Switch to POS Mode/ }).click()
    await expect(window.getByText('POS Mode', { exact: true })).toBeVisible()

    // Default = "In for repair (Pending)" → date + priority visible.
    await window.getByRole('button', { name: /In for repair/ }).click()
    await expect(window.locator('input[type=date]')).toHaveCount(1)
    await expect(window.getByText('Estimated Delivery Date')).toBeVisible()

    // "Taking now — Paid in full" → both hidden.
    await window.getByRole('button', { name: /Paid in full/ }).click()
    await expect(window.locator('input[type=date]')).toHaveCount(0)
    await expect(window.getByText('Estimated Delivery Date')).toHaveCount(0)
    await shoot(window, '19-pos-conditional-hidden')

    // "Taking now — On credit" → still hidden.
    await window.getByRole('button', { name: /On credit/ }).click()
    await expect(window.locator('input[type=date]')).toHaveCount(0)

    // Back to pending → visible again.
    await window.getByRole('button', { name: /In for repair/ }).click()
    await expect(window.locator('input[type=date]')).toHaveCount(1)

    // Leave POS mode for later tests.
    await window.getByRole('button', { name: /Switch to Dashboard/ }).click()
  })

  test('Backend (IPC) enforces phone / IMEI / advance independently of the form', async () => {
    const results = await window.evaluate(async (suffix) => {
      const tryCall = async (fn: () => Promise<unknown>): Promise<'ok' | 'rejected'> => {
        try {
          await fn()
          return 'ok'
        } catch {
          return 'rejected'
        }
      }

      // 1. Bad phone (10 digits) is rejected at the IPC layer.
      const badPhone = await tryCall(() => window.api.customers.create({ name: `IPC Bad ${suffix}`, phone: `0300${suffix}` }))
      // 2. A valid customer is accepted (and gives us an id for the repair calls).
      const good = await window.api.customers.create({ name: `IPC Good ${suffix}`, phone: `03011${suffix}` })
      // 3. Advance > price is rejected.
      const badAdvance = await tryCall(() =>
        window.api.repairs.create({
          customerId: good.id,
          deviceBrand: 'B',
          deviceModel: `IPC-ADV-${suffix}`,
          issue: 'x',
          repairPrice: 1000,
          advanceAmount: 2000
        })
      )
      // 4. IMEI with letters is rejected.
      const badImei = await tryCall(() =>
        window.api.repairs.create({
          customerId: good.id,
          deviceBrand: 'B',
          deviceModel: `IPC-IMEI-${suffix}`,
          issue: 'x',
          imei: 'ABC123',
          repairPrice: 1000
        })
      )
      // 5. A clean repair is accepted.
      const okRepair = await tryCall(() =>
        window.api.repairs.create({
          customerId: good.id,
          deviceBrand: 'B',
          deviceModel: `IPC-OK-${suffix}`,
          issue: 'x',
          imei: '123456789012345',
          repairPrice: 1000,
          advanceAmount: 500
        })
      )
      return { badPhone, badAdvance, badImei, okRepair }
    }, SUFFIX)

    expect(results.badPhone).toBe('rejected')
    expect(results.badAdvance).toBe('rejected')
    expect(results.badImei).toBe('rejected')
    expect(results.okRepair).toBe('ok')
  })

  test('Category 1 backend guards: money sign, dates, IMEI length, name letters, expense (IPC)', async () => {
    const r = await window.evaluate(async (suffix) => {
      const tryCall = async (fn: () => Promise<unknown>): Promise<'ok' | 'rejected'> => {
        try {
          await fn()
          return 'ok'
        } catch {
          return 'rejected'
        }
      }
      const tomorrow = (() => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })()

      const cust = await window.api.customers.create({ name: `Guard ${suffix}`, phone: `03014${suffix}` })
      const repair = await window.api.repairs.create({ customerId: cust.id, deviceBrand: 'B', deviceModel: `GUARD-${suffix}`, issue: 'x', repairPrice: 1000 })

      return {
        // Money sign
        negativePrice: await tryCall(() => window.api.repairs.create({ customerId: cust.id, deviceBrand: 'B', deviceModel: `NEG-${suffix}`, issue: 'x', repairPrice: -100 })),
        zeroPayment: await tryCall(() => window.api.payments.record({ repairId: repair.id, amount: 0, type: 'partial', paymentDate: '2020-01-01' })),
        negativePayment: await tryCall(() => window.api.payments.record({ repairId: repair.id, amount: -50, type: 'partial', paymentDate: '2020-01-01' })),
        // Dates in the future
        futurePayment: await tryCall(() => window.api.payments.record({ repairId: repair.id, amount: 100, type: 'partial', paymentDate: tomorrow })),
        // IMEI length
        imeiTooShort: await tryCall(() => window.api.repairs.create({ customerId: cust.id, deviceBrand: 'B', deviceModel: `IMEIB-${suffix}`, issue: 'x', imei: '12345', repairPrice: 100 })),
        // Name must contain letters
        numericName: await tryCall(() => window.api.customers.create({ name: '1234567', phone: `03015${suffix}` })),
        // Empty device brand
        emptyBrand: await tryCall(() => window.api.repairs.create({ customerId: cust.id, deviceBrand: '   ', deviceModel: `EB-${suffix}`, issue: 'x', repairPrice: 100 })),
        // Expense guards
        negativeExpense: await tryCall(() => window.api.expenses.create({ category: 'rent', amount: -10, description: null, expenseDate: '2024-01-01', isRecurring: false, recurringMonth: null })),
        futureExpense: await tryCall(() => window.api.expenses.create({ category: 'rent', amount: 10, description: null, expenseDate: tomorrow, isRecurring: false, recurringMonth: null })),
        // Udhaar settlement future date
        futureSettlement: await (async () => {
          const u = await window.api.udhaar.create({ personName: `U ${suffix}`, personPhone: null, customerId: null, direction: 'receivable', totalAmount: 500, dueDate: null, notes: null })
          return tryCall(() => window.api.udhaar.recordSettlement({ udhaarId: u.id, amount: 100, settlementDate: tomorrow, notes: null }))
        })(),
        // Positive controls that must succeed
        okPayment: await tryCall(() => window.api.payments.record({ repairId: repair.id, amount: 100, type: 'partial', paymentDate: '2024-06-01' })),
        okExpense: await tryCall(() => window.api.expenses.create({ category: 'rent', amount: 10, description: null, expenseDate: '2024-06-01', isRecurring: false, recurringMonth: null }))
      }
    }, SUFFIX)

    expect(r.negativePrice).toBe('rejected')
    expect(r.zeroPayment).toBe('rejected')
    expect(r.negativePayment).toBe('rejected')
    expect(r.futurePayment).toBe('rejected')
    expect(r.imeiTooShort).toBe('rejected')
    expect(r.numericName).toBe('rejected')
    expect(r.emptyBrand).toBe('rejected')
    expect(r.negativeExpense).toBe('rejected')
    expect(r.futureExpense).toBe('rejected')
    expect(r.futureSettlement).toBe('rejected')
    expect(r.okPayment).toBe('ok')
    expect(r.okExpense).toBe('ok')
  })

  test('Category 2: concurrent double-delivery records exactly one payment (idempotent)', async () => {
    const r = await window.evaluate(async (suffix) => {
      const cust = await window.api.customers.create({ name: `Race ${suffix}`, phone: `03016${suffix}` })
      const repair = await window.api.repairs.create({ customerId: cust.id, deviceBrand: 'B', deviceModel: `RACE-${suffix}`, issue: 'x', repairPrice: 2000 })
      // Move to 'completed' so it's deliverable.
      await window.api.repairs.update(repair.id, { status: 'completed' })

      // Fire TWO delivery calls concurrently (simulates a rapid double-click that
      // beats the UI disable). The main process serializes them; the second must
      // not create a second payment.
      const settled = await Promise.allSettled([
        window.api.repairs.deliverWithFullPayment(repair.id),
        window.api.repairs.deliverWithFullPayment(repair.id)
      ])

      const payments = await window.api.payments.findByRepairId(repair.id)
      const finalRepair = await window.api.repairs.getById(repair.id)
      return {
        rejectedCount: settled.filter((s) => s.status === 'rejected').length,
        paymentCount: payments.length,
        totalPaid: payments.reduce((sum, p) => sum + p.amount, 0),
        status: finalRepair?.status,
        remaining: finalRepair?.remainingBalance
      }
    }, SUFFIX)

    // Exactly one payment for the full 2000; delivered; balance zero. No duplicate.
    expect(r.paymentCount).toBe(1)
    expect(r.totalPaid).toBe(2000)
    expect(r.status).toBe('delivered')
    expect(r.remaining).toBe(0)
  })

  test('Category 4: 50% split on a decimal price sums back exactly, and tiny/huge amounts round-trip', async () => {
    const r = await window.evaluate(async (suffix) => {
      const round2 = (n: number): number => Math.round(n * 100) / 100
      const cust = await window.api.customers.create({ name: `Money ${suffix}`, phone: `03017${suffix}` })

      // (a) 50% split on an odd decimal price (1500.55).
      const rp = 1500.55
      const split = await window.api.repairs.create({ customerId: cust.id, deviceBrand: 'B', deviceModel: `SPLIT-${suffix}`, issue: 'x', repairPrice: rp })
      await window.api.repairs.update(split.id, { status: 'completed' })
      const half = round2(rp / 2) // what the "Half" quick-button sends
      const credit = await window.api.repairs.deliverOnCredit({ repairId: split.id, udhaarAmount: half, dueDate: null })
      const splitRepair = await window.api.repairs.getById(split.id)
      // Settle the udhaar in full; total collected must equal the original price.
      await window.api.udhaar.recordSettlement({ udhaarId: credit.udhaar.id, amount: credit.udhaar.totalAmount, settlementDate: '2024-06-01', notes: null })
      const afterSettlePayments = await window.api.payments.findByRepairId(split.id)
      const afterSettleRepair = await window.api.repairs.getById(split.id)

      // (b) tiny + huge amounts through full-payment delivery.
      const tiny = await window.api.repairs.create({ customerId: cust.id, deviceBrand: 'B', deviceModel: `TINY-${suffix}`, issue: 'x', repairPrice: 0.01 })
      await window.api.repairs.update(tiny.id, { status: 'completed' })
      await window.api.repairs.deliverWithFullPayment(tiny.id)
      const tinyRepair = await window.api.repairs.getById(tiny.id)

      const huge = await window.api.repairs.create({ customerId: cust.id, deviceBrand: 'B', deviceModel: `HUGE-${suffix}`, issue: 'x', repairPrice: 99999999 })
      await window.api.repairs.update(huge.id, { status: 'completed' })
      await window.api.repairs.deliverWithFullPayment(huge.id)
      const hugeRepair = await window.api.repairs.getById(huge.id)
      const hugePayments = await window.api.payments.findByRepairId(huge.id)

      return {
        paidNow: credit.payment?.amount ?? 0,
        onCredit: credit.udhaar?.totalAmount ?? 0,
        splitSum: round2((credit.payment?.amount ?? 0) + (credit.udhaar?.totalAmount ?? 0)),
        splitRemainingAfterCredit: splitRepair?.remainingBalance,
        totalCollectedAfterSettle: round2(afterSettlePayments.reduce((s, p) => s + p.amount, 0)),
        splitRemainingFinal: afterSettleRepair?.remainingBalance,
        tinyRemaining: tinyRepair?.remainingBalance,
        hugeRemaining: hugeRepair?.remainingBalance,
        hugePaid: hugePayments.reduce((s, p) => s + p.amount, 0)
      }
    }, SUFFIX)

    // Split: the two parts sum back to the exact original price, no leaked paisa.
    expect(r.splitSum).toBe(1500.55)
    expect(r.splitRemainingAfterCredit).toBe(r.onCredit) // repair still owes exactly the credit portion
    // Full settlement collects the whole original price and zeroes the repair.
    expect(r.totalCollectedAfterSettle).toBe(1500.55)
    expect(r.splitRemainingFinal).toBe(0)
    // Tiny + huge amounts settle cleanly to zero with the exact amount recorded.
    expect(r.tinyRemaining).toBe(0)
    expect(r.hugeRemaining).toBe(0)
    expect(r.hugePaid).toBe(99999999)
  })

  test('Category 5: state-machine sequencing (linked-udhaar cancel block, price edits, customer delete guard)', async () => {
    const r = await window.evaluate(async (suffix) => {
      const tryCall = async (fn: () => Promise<unknown>): Promise<'ok' | 'rejected'> => {
        try {
          await fn()
          return 'ok'
        } catch {
          return 'rejected'
        }
      }
      const cust = await window.api.customers.create({ name: `SM ${suffix}`, phone: `03019${suffix}` })

      // (1) A repair delivered on credit has a linked receivable udhaar and is
      //     'delivered' (locked) — it cannot be cancelled, so the udhaar can't be orphaned.
      const linked = await window.api.repairs.create({ customerId: cust.id, deviceBrand: 'B', deviceModel: `LINK-${suffix}`, issue: 'x', repairPrice: 1000 })
      await window.api.repairs.update(linked.id, { status: 'completed' })
      const credit = await window.api.repairs.deliverOnCredit({ repairId: linked.id, udhaarAmount: 600, dueDate: null })
      const cancelLinked = await tryCall(() => window.api.repairs.update(linked.id, { status: 'cancelled' }))
      const linkedUdhaar = await window.api.udhaar.findByRepairId(linked.id)

      // (3) Editing a pending repair's price multiple times: only the final price counts.
      const edited = await window.api.repairs.create({ customerId: cust.id, deviceBrand: 'B', deviceModel: `EDIT-${suffix}`, issue: 'x', repairPrice: 1000 })
      await window.api.repairs.update(edited.id, { repairPrice: 2000 })
      await window.api.repairs.update(edited.id, { repairPrice: 1500 })
      await window.api.repairs.update(edited.id, { status: 'completed' })
      await window.api.repairs.deliverWithFullPayment(edited.id)
      const editedPayments = await window.api.payments.findByRepairId(edited.id)
      const editedRepair = await window.api.repairs.getById(edited.id)

      // (4) Customer delete guard: blocked while a repair is active; allowed once delivered.
      const delCust = await window.api.customers.create({ name: `Del ${suffix}`, phone: `03020${suffix}` })
      const activeRepair = await window.api.repairs.create({ customerId: delCust.id, deviceBrand: 'B', deviceModel: `DEL-${suffix}`, issue: 'x', repairPrice: 500 })
      const deleteWhileActive = await tryCall(() => window.api.customers.softDelete(delCust.id))
      await window.api.repairs.update(activeRepair.id, { status: 'completed' })
      await window.api.repairs.deliverWithFullPayment(activeRepair.id)
      const deleteAfterDelivered = await tryCall(() => window.api.customers.softDelete(delCust.id))

      return {
        cancelLinked,
        linkedUdhaarStillThere: linkedUdhaar.length === 1 && linkedUdhaar[0].totalAmount === 600,
        finalPaid: editedPayments.reduce((s, p) => s + p.amount, 0),
        editedRemaining: editedRepair?.remainingBalance,
        deleteWhileActive,
        deleteAfterDelivered
      }
    }, SUFFIX)

    // (1) cancel of a linked-udhaar (delivered) repair is rejected; udhaar intact.
    expect(r.cancelLinked).toBe('rejected')
    expect(r.linkedUdhaarStillThere).toBe(true)
    // (3) only the final saved price (1500) drives the payment/balance.
    expect(r.finalPaid).toBe(1500)
    expect(r.editedRemaining).toBe(0)
    // (4) delete blocked while active, allowed after delivery.
    expect(r.deleteWhileActive).toBe('rejected')
    expect(r.deleteAfterDelivered).toBe('ok')
  })

  test('Category 10: Urdu names round-trip through create + search (IPC)', async () => {
    const found = await window.evaluate(async (suffix) => {
      const name = `محمد علی ${suffix}`
      await window.api.customers.create({ name, phone: `03021${suffix}` })
      // Search by an Urdu substring must find it (UTF-8 LIKE).
      const results = await window.api.customers.list({ search: 'علی' })
      return results.some((c) => c.name === name)
    }, SUFFIX)
    expect(found).toBe(true)
  })

  test('Category 10 + 13: numeric fields reject Arabic/Urdu-indic digits; notes cap at max length (UI)', async () => {
    await openNewRepairForm(window)
    await createCustomerInPicker(window, `Locale Cust ${SUFFIX}`, `03022${SUFFIX}`)

    await window.getByLabel(/Device Brand/).fill('Samsung')
    await window.getByLabel(/Device Model/).fill(`LOCALE-${SUFFIX}`)
    await window.locator('textarea').first().fill('locale test')

    // Arabic/Urdu-indic digits in a money field are rejected (Western digits only).
    await window.getByLabel(/Total Price/).fill('۱۲۳۴') // Urdu digits for 1234
    await window.getByRole('button', { name: 'Save' }).click()
    await expect(window.getByText(/Enter a valid amount/)).toBeVisible()

    // Notes textarea caps a huge paste at MAX_NOTES (2000) — no unbounded input.
    const notes = window.locator('textarea').nth(1) // the Notes textarea
    await notes.fill('x'.repeat(5000))
    expect((await notes.inputValue()).length).toBe(2000)
    await shoot(window, '19-locale-and-notes-cap')
  })

  test('Default sort: Repairs and Customers lists are newest-first', async () => {
    const order = await window.evaluate(async (suffix) => {
      // Small gaps guarantee distinct createdAt timestamps so the ordering is
      // deterministic (createdAt has ms precision; real users never create two
      // records in the same ms, but a tight test loop can).
      const gap = () => new Promise((r) => setTimeout(r, 5))

      // Two customers created back-to-back; the SECOND must sort first.
      const first = await window.api.customers.create({ name: `Sort A ${suffix}`, phone: `03012${suffix}` })
      await gap()
      const second = await window.api.customers.create({ name: `Sort B ${suffix}`, phone: `03013${suffix}` })

      const customers = await window.api.customers.list()
      const firstIdx = customers.findIndex((c) => c.id === first.id)
      const secondIdx = customers.findIndex((c) => c.id === second.id)

      const rOld = await window.api.repairs.create({ customerId: first.id, deviceBrand: 'B', deviceModel: `SORT-OLD-${suffix}`, issue: 'x', repairPrice: 100 })
      await gap()
      const rNew = await window.api.repairs.create({ customerId: first.id, deviceBrand: 'B', deviceModel: `SORT-NEW-${suffix}`, issue: 'x', repairPrice: 100 })
      const repairs = await window.api.repairs.list()
      const rOldIdx = repairs.findIndex((r) => r.id === rOld.id)
      const rNewIdx = repairs.findIndex((r) => r.id === rNew.id)

      return { secondBeforeFirst: secondIdx < firstIdx, newBeforeOld: rNewIdx < rOldIdx }
    }, SUFFIX)

    expect(order.secondBeforeFirst).toBe(true)
    expect(order.newBeforeOld).toBe(true)
  })
})
