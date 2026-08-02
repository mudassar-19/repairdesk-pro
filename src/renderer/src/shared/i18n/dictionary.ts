import type { BilingualString } from './types'

/**
 * Every UI string lives here as { en, ur }. There is no language toggle —
 * BilingualText always renders both, so both fields are required at the
 * type level (a missing translation is a compile error, not a runtime gap).
 */
export const dictionary = {
  app: {
    name: { en: 'RepairDesk Pro', ur: 'ریپیئر ڈیسک پرو' }
  },
  nav: {
    dashboard: { en: 'Dashboard', ur: 'ڈیش بورڈ' },
    customers: { en: 'Customers', ur: 'گاہک' },
    repairs: { en: 'Repairs', ur: 'مرمت' },
    payments: { en: 'Payments', ur: 'ادائیگیاں' },
    expenses: { en: 'Expenses', ur: 'اخراجات' },
    reports: { en: 'Reports', ur: 'رپورٹس' },
    sync: { en: 'Sync', ur: 'ہم آہنگی' },
    backup: { en: 'Backup', ur: 'بیک اپ' },
    settings: { en: 'Settings', ur: 'ترتیبات' }
  },
  auth: {
    signIn: { en: 'Sign In', ur: 'سائن ان' },
    email: { en: 'Email', ur: 'ای میل' },
    password: { en: 'Password', ur: 'پاس ورڈ' },
    submit: { en: 'Log In', ur: 'لاگ ان' },
    loggingIn: { en: 'Logging in…', ur: 'لاگ ان ہو رہا ہے…' },
    tagline: { en: 'Sign in to your workshop', ur: 'اپنی ورکشاپ میں سائن ان کریں' }
  },
  settings: {
    logout: { en: 'Log Out', ur: 'لاگ آؤٹ' },
    loggedInAs: { en: 'Logged in as', ur: 'بطور لاگ ان' }
  },
  customers: {
    searchPlaceholder: { en: 'Search by name or phone', ur: 'نام یا فون سے تلاش کریں' },
    addNew: { en: 'Add Customer', ur: 'نیا گاہک شامل کریں' },
    name: { en: 'Name', ur: 'نام' },
    phone: { en: 'Phone', ur: 'فون نمبر' },
    address: { en: 'Address', ur: 'پتہ' },
    notes: { en: 'Notes', ur: 'نوٹس' },
    totalRepairs: { en: 'Total Repairs', ur: 'کل مرمتیں' },
    lastVisit: { en: 'Last Visit', ur: 'آخری وزٹ' },
    totalSpent: { en: 'Total Spent', ur: 'کل خرچ' },
    repairHistory: { en: 'Repair History', ur: 'مرمت کی تاریخ' },
    noRepairsYet: { en: 'No repairs yet', ur: 'ابھی کوئی مرمت نہیں' },
    noRepairsYetBody: {
      en: 'Repairs for this customer will show up here once the Repairs module is built.',
      ur: 'مرمت ماڈیول بننے کے بعد اس گاہک کی مرمتیں یہاں نظر آئیں گی۔'
    },
    emptyTitle: { en: 'No customers yet', ur: 'ابھی کوئی گاہک نہیں' },
    emptyBody: {
      en: 'Add your first customer to get started.',
      ur: 'شروع کرنے کے لیے اپنا پہلا گاہک شامل کریں۔'
    },
    save: { en: 'Save', ur: 'محفوظ کریں' },
    cancel: { en: 'Cancel', ur: 'منسوخ کریں' },
    edit: { en: 'Edit', ur: 'ترمیم کریں' },
    delete: { en: 'Delete', ur: 'حذف کریں' },
    editCustomer: { en: 'Edit Customer', ur: 'گاہک میں ترمیم کریں' },
    deleteConfirmTitle: { en: 'Delete this customer?', ur: 'کیا اس گاہک کو حذف کریں؟' },
    deleteConfirmBody: {
      en: 'They will no longer appear in customer lists or search.',
      ur: 'وہ اب گاہک کی فہرست یا تلاش میں نظر نہیں آئیں گے۔'
    },
    duplicateTitle: { en: 'Customer already exists', ur: 'گاہک پہلے سے موجود ہے' },
    duplicateBody: {
      en: 'This phone number is already registered to:',
      ur: 'یہ فون نمبر پہلے سے درج ہے:'
    },
    duplicateArchived: {
      en: 'This phone number belonged to a removed customer. Please use a different number.',
      ur: 'یہ فون نمبر ایک حذف شدہ گاہک کا تھا۔ براہ کرم مختلف نمبر استعمال کریں۔'
    },
    openProfile: { en: 'Open Profile', ur: 'پروفائل کھولیں' },
    useExisting: { en: 'Use This Customer', ur: 'یہ گاہک استعمال کریں' },
    createNew: { en: 'Create New Customer', ur: 'نیا گاہک بنائیں' },
    pickerPlaceholder: { en: 'Search or add customer', ur: 'گاہک تلاش یا شامل کریں' },
    noMatches: { en: 'No matching customers', ur: 'کوئی مماثل گاہک نہیں' },
    changeCustomer: { en: 'Change', ur: 'تبدیل کریں' },
    notFound: { en: 'Customer not found', ur: 'گاہک نہیں ملا' },
    backToList: { en: 'Back to customers', ur: 'گاہکوں کی فہرست پر واپس جائیں' }
  },
  common: {
    loading: { en: 'Loading…', ur: 'لوڈ ہو رہا ہے…' },
    emptyStateTitle: { en: 'No records yet', ur: 'ابھی کوئی ریکارڈ موجود نہیں' },
    emptyStateBody: {
      en: 'This module is part of Phase 1 scaffolding. Functionality arrives in a later phase.',
      ur: 'یہ ماڈیول فیز 1 کے بنیادی ڈھانچے کا حصہ ہے۔ فعالیت بعد کے مرحلے میں شامل ہوگی۔'
    }
  }
} as const satisfies Record<string, Record<string, BilingualString>>

export type DictionaryShape = typeof dictionary
