import type { AppDatabase } from './client'
import { CustomerRepository } from './repositories/customerRepository'
import { RepairRepository } from './repositories/repairRepository'

/**
 * Dev-only sample data so Phase 4+ UI modules have something to render
 * before real shop data exists. Only ever called behind is.dev in
 * main/index.ts — never runs in a packaged build. Skips seeding if customers
 * already exist, so relaunching `npm run dev` doesn't keep duplicating rows.
 */
export function seedDevData(db: AppDatabase): void {
  const customerRepo = new CustomerRepository(db)
  const repairRepo = new RepairRepository(db)

  if (customerRepo.findAll().length > 0) {
    console.log('[seed] Dev sample data already present — skipping.')
    return
  }

  const ali = customerRepo.create({
    name: 'Ali Raza',
    phone: '03001234567',
    address: 'Gulberg, Lahore'
  })
  const sana = customerRepo.create({
    name: 'Sana Khan',
    phone: '03214567890',
    notes: 'Prefers WhatsApp updates'
  })
  const bilal = customerRepo.create({
    name: 'Bilal Ahmed',
    phone: '03331112233',
    address: 'DHA Phase 5, Karachi'
  })

  repairRepo.create({
    customerId: ali.id,
    deviceBrand: 'Samsung',
    deviceModel: 'Galaxy A54',
    issue: 'Cracked screen',
    accessories: 'Charger',
    status: 'pending',
    costPrice: 8000,
    repairPrice: 12000,
    advanceAmount: 5000,
    priority: 'normal'
  })

  repairRepo.create({
    customerId: sana.id,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 12 Pro',
    issue: 'Battery replacement',
    status: 'completed',
    costPrice: 4500,
    repairPrice: 7000,
    advanceAmount: 7000,
    priority: 'high'
  })

  repairRepo.create({
    customerId: bilal.id,
    deviceBrand: 'Xiaomi',
    deviceModel: 'Redmi Note 11',
    issue: 'Charging port loose',
    status: 'pending',
    costPrice: 1500,
    repairPrice: 3000,
    advanceAmount: 0,
    priority: 'low'
  })

  console.log(
    `[seed] Inserted ${customerRepo.findAll().length} customers and ${repairRepo.findAll().length} repairs.`
  )
}
