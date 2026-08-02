import type { AppDatabase } from './client'
import {
  CustomerRepository,
  RepairRepository,
  PaymentRepository,
  ExpenseRepository,
  SettingsRepository,
  ActivityLogRepository
} from './repositories'

/**
 * Dev-only smoke test proving every repository's CRUD surface works
 * end-to-end, since Phase 3 has no UI yet to exercise it manually. Only ever
 * called behind is.dev in main/index.ts. Runs on every dev boot (cheap, and
 * self-cleans via softDelete) rather than once, so it keeps proving the
 * repositories still work as later phases touch the schema.
 */
export function runRepositorySelfTest(db: AppDatabase): void {
  console.log('[self-test] Running repository CRUD smoke test...')

  const customerRepo = new CustomerRepository(db)
  const repairRepo = new RepairRepository(db)
  const paymentRepo = new PaymentRepository(db)
  const expenseRepo = new ExpenseRepository(db)
  const settingsRepo = new SettingsRepository(db)
  const activityRepo = new ActivityLogRepository(db)

  const customer = customerRepo.create({ name: '__selftest__', phone: `selftest-${Date.now()}` })
  console.log('[self-test] CustomerRepository.create ->', customer.id)
  console.log('[self-test] CustomerRepository.findById ->', Boolean(customerRepo.findById(customer.id)))

  const updatedCustomer = customerRepo.update(customer.id, { notes: 'updated by self-test' })
  console.log('[self-test] CustomerRepository.update ->', updatedCustomer?.notes)

  const repair = repairRepo.create({
    customerId: customer.id,
    deviceBrand: 'TestBrand',
    deviceModel: 'TestModel',
    issue: 'Self-test issue',
    repairPrice: 1000,
    advanceAmount: 200
  })
  console.log('[self-test] RepairRepository.create -> remainingBalance =', repair.remainingBalance)

  const payment = paymentRepo.create({
    repairId: repair.id,
    amount: 200,
    type: 'advance',
    paymentDate: new Date().toISOString()
  })
  console.log('[self-test] PaymentRepository.create ->', payment.id)

  const expense = expenseRepo.create({
    category: 'supplies',
    amount: 500,
    expenseDate: new Date().toISOString()
  })
  console.log('[self-test] ExpenseRepository.create ->', expense.id)

  // Uses a throwaway key, not the real 'branding' domain — a self-test must
  // never overwrite actual app config.
  settingsRepo.set('__selftest__', { checkedAt: new Date().toISOString() })
  console.log('[self-test] SettingsRepository.get ->', settingsRepo.get('__selftest__'))

  activityRepo.create({ actionType: 'selftest', entityType: 'system', description: 'Self-test entry' })
  console.log('[self-test] ActivityLogRepository.findAll count ->', activityRepo.findAll({ limit: 5 }).length)

  customerRepo.softDelete(customer.id)
  repairRepo.softDelete(repair.id)
  paymentRepo.softDelete(payment.id)
  expenseRepo.softDelete(expense.id)
  console.log(
    '[self-test] softDelete verified ->',
    customerRepo.findById(customer.id)?.isDeleted,
    repairRepo.findById(repair.id)?.isDeleted,
    paymentRepo.findById(payment.id)?.isDeleted,
    expenseRepo.findById(expense.id)?.isDeleted
  )
  console.log('[self-test] findAll excludes soft-deleted ->', customerRepo.findAll().some((c) => c.id === customer.id) === false)

  console.log('[self-test] Repository CRUD smoke test complete.')
}
