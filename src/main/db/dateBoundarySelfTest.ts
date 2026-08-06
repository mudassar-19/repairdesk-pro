import type { AppDatabase } from './client'
import { CustomerRepository } from './repositories/customerRepository'
import { RepairRepository } from './repositories/repairRepository'
import { PaymentRepository } from './repositories/paymentRepository'
import { DashboardRepository } from './repositories/dashboardRepository'
import { formatLocalDate } from '../lib/date'

/**
 * Regression guard for the month-boundary timezone bug (fixed alongside this
 * file): DashboardRepository.getSummary() used to build its month-start
 * boundary as `new Date(year, month, 1).toISOString().slice(0, 10)`, which
 * silently shifted the calendar date backward by one day for any
 * positive-UTC-offset timezone (Pakistan, this app's primary deployment,
 * included) — so a payment made on the last day of the previous month got
 * counted in "this month"'s revenue. Unlike runRepositorySelfTest's
 * observational console.log style, this throws on failure — a console line
 * nobody reads doesn't stop this exact bug class from silently shipping
 * again, which is the whole point of a regression guard.
 *
 * Only ever runs behind is.dev (see main/index.ts), same as every other
 * self-test in this file's family.
 */
export function runDateBoundarySelfTest(db: AppDatabase): void {
  console.log('[self-test] Running month-boundary timezone regression check...')

  // Unit-level: formatLocalDate must read LOCAL calendar components, never a
  // UTC round-trip. A fixed date (independent of today's real date) so this
  // assertion means the same thing regardless of when the app happens to run.
  const knownLocalMidnight = new Date(2026, 0, 1) // Jan 1, 2026, local midnight
  const formatted = formatLocalDate(knownLocalMidnight)
  if (formatted !== '2026-01-01') {
    throw new Error(
      `[self-test] REGRESSION: formatLocalDate(Jan 1 2026 local midnight) returned "${formatted}", expected "2026-01-01" ` +
        '— this is the exact timezone-boundary defect that once let payments from the last day of the previous month ' +
        'leak into "this month" figures. See main/lib/date.ts.'
    )
  }

  // Integration-level: a payment dated the last day of the PREVIOUS month
  // must never move DashboardRepository.getSummary().monthlyRevenue — a
  // before/after delta, not an absolute threshold, so this is correct
  // regardless of how much real revenue already exists this month.
  const now = new Date()
  const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0) // day 0 = last day of previous month

  const customerRepo = new CustomerRepository(db)
  const repairRepo = new RepairRepository(db)
  const paymentRepo = new PaymentRepository(db)

  const customer = customerRepo.create({ name: '__dateboundarytest__', phone: `dbtest-${Date.now()}` })
  const repair = repairRepo.create({
    customerId: customer.id,
    deviceBrand: 'Test',
    deviceModel: 'Test',
    issue: 'Month-boundary regression check',
    repairPrice: 999999
  })

  const before = new DashboardRepository(db).getSummary().monthlyRevenue
  const payment = paymentRepo.create({ repairId: repair.id, amount: 999999, type: 'full', paymentDate: formatLocalDate(lastDayOfPrevMonth) })
  const after = new DashboardRepository(db).getSummary().monthlyRevenue

  paymentRepo.softDelete(payment.id)
  repairRepo.softDelete(repair.id)
  customerRepo.softDelete(customer.id)

  if (after !== before) {
    throw new Error(
      `[self-test] REGRESSION: DashboardRepository.getSummary().monthlyRevenue changed from ${before} to ${after} ` +
        'after adding a payment dated the last day of the PREVIOUS month — it should never have been counted. ' +
        'The month-boundary timezone bug is back; check every call site still uses main/lib/date.ts\'s formatLocalDate.'
    )
  }

  console.log('[self-test] Month-boundary timezone regression check passed.')
}
