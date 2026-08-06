import type { BilingualString } from './types'

/**
 * Every UI string lives here as { en, ur }. There is no language toggle —
 * BilingualText always renders both, so both fields are required at the
 * type level (a missing translation is a compile error, not a runtime gap).
 */
export const dictionary = {
  app: {
    name: { en: 'RepairDex Pro', ur: 'ریپیئر ڈیکس پرو' }
  },
  nav: {
    dashboard: { en: 'Dashboard', ur: 'ڈیش بورڈ' },
    customers: { en: 'Customers', ur: 'گاہک' },
    repairs: { en: 'Repairs', ur: 'مرمت' },
    payments: { en: 'Payments', ur: 'ادائیگیاں' },
    expenses: { en: 'Expenses', ur: 'اخراجات' },
    udhaar: { en: 'Udhaar', ur: 'ادھار' },
    reports: { en: 'Reports', ur: 'رپورٹس' },
    analytics: { en: 'Analytics', ur: 'تجزیات' },
    activity: { en: 'Activity', ur: 'سرگرمی' },
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
  branding: {
    title: { en: 'Shop Branding', ur: 'دکان کی برانڈنگ' },
    logo: { en: 'Logo', ur: 'لوگو' },
    uploadLogo: { en: 'Upload Logo…', ur: 'لوگو اپ لوڈ کریں…' },
    removeLogo: { en: 'Remove', ur: 'ہٹائیں' },
    shopName: { en: 'Shop Name', ur: 'دکان کا نام' },
    currency: { en: 'Currency Symbol', ur: 'کرنسی کی علامت' },
    address: { en: 'Address', ur: 'پتہ' },
    phone: { en: 'Phone', ur: 'فون نمبر' },
    email: { en: 'Email', ur: 'ای میل' },
    primaryColor: { en: 'Brand Color', ur: 'برانڈ کا رنگ' },
    save: { en: 'Save', ur: 'محفوظ کریں' },
    saved: { en: 'Saved', ur: 'محفوظ ہو گیا' }
  },
  receiptSettings: {
    title: { en: 'Receipt Settings', ur: 'رسید کی ترتیبات' },
    headerText: { en: 'Header Text', ur: 'ہیڈر کی تحریر' },
    headerTextHint: { en: 'Optional line shown below your logo on every receipt', ur: 'اختیاری سطر جو ہر رسید پر آپ کے لوگو کے نیچے دکھائی جائے گی' },
    footerText: { en: 'Footer Text', ur: 'فوٹر کی تحریر' },
    footerTextHint: {
      en: 'e.g. "Thank you for your business" or a warranty note — shown at the bottom of every receipt',
      ur: 'مثلاً "آپ کے کاروبار کا شکریہ" یا وارنٹی کا نوٹ — ہر رسید کے آخر میں دکھایا جائے گا'
    }
  },
  backup: {
    title: { en: 'Backup & Restore', ur: 'بیک اپ اور بحالی' },
    settingsTitle: { en: 'Backup Settings', ur: 'بیک اپ کی ترتیبات' },
    defaultLocation: { en: 'Default Location', ur: 'ڈیفالٹ مقام' },
    builtInLocation: { en: 'Built-in (App Data folder)', ur: 'بلٹ ان (ایپ ڈیٹا فولڈر)' },
    changeLocation: { en: 'Change…', ur: 'تبدیل کریں…' },
    resetToDefault: { en: 'Reset to Default', ur: 'ڈیفالٹ پر بحال کریں' },
    frequency: { en: 'Automatic Backup Frequency', ur: 'خودکار بیک اپ کی تعدد' },
    frequencyDaily: { en: 'Daily', ur: 'روزانہ' },
    frequencyWeekly: { en: 'Weekly', ur: 'ہفتہ وار' },
    retentionCount: { en: 'Keep Recent Backups', ur: 'حالیہ بیک اپس محفوظ رکھیں' },
    backupNow: { en: 'Backup Now', ur: 'ابھی بیک اپ کریں' },
    chooseLocation: { en: 'Choose Location…', ur: 'مقام منتخب کریں…' },
    creatingBackup: { en: 'Creating backup…', ur: 'بیک اپ بن رہا ہے…' },
    backupSuccess: { en: 'Backup created', ur: 'بیک اپ بن گیا' },
    backupFailed: { en: 'Backup failed', ur: 'بیک اپ ناکام ہوا' },
    availableBackups: { en: 'Available Backups', ur: 'دستیاب بیک اپس' },
    noBackupsYet: { en: 'No backups yet', ur: 'ابھی تک کوئی بیک اپ نہیں' },
    kindAuto: { en: 'Automatic', ur: 'خودکار' },
    kindManual: { en: 'Manual', ur: 'دستی' },
    kindSafety: { en: 'Pre-restore safety copy', ur: 'بحالی سے پہلے حفاظتی کاپی' },
    restoreFromFile: { en: 'Restore from File…', ur: 'فائل سے بحال کریں…' },
    restore: { en: 'Restore', ur: 'بحال کریں' },
    restoreConfirmTitle: { en: 'Restore this backup?', ur: 'یہ بیک اپ بحال کریں؟' },
    restoreConfirmBody: {
      en: 'All current data will be replaced with this backup. A safety copy of your current data will be created first, and the app will restart automatically.',
      ur: 'تمام موجودہ ڈیٹا اس بیک اپ سے تبدیل ہو جائے گا۔ پہلے آپ کے موجودہ ڈیٹا کی ایک حفاظتی کاپی بنائی جائے گی، اور ایپ خود بخود دوبارہ شروع ہو جائے گی۔'
    },
    restoring: { en: 'Restoring — the app will restart shortly…', ur: 'بحالی جاری ہے — ایپ جلد دوبارہ شروع ہو گی…' },
    restoreFailed: { en: 'Restore failed', ur: 'بحالی ناکام ہوئی' },
    invalidBackupFile: { en: 'This file is not a valid RepairDex Pro backup', ur: 'یہ فائل ایک درست ریپیئر ڈیکس پرو بیک اپ نہیں ہے' },
    cancel: { en: 'Cancel', ur: 'منسوخ کریں' }
  },
  cloudBackup: {
    title: { en: 'Cloud Backup', ur: 'کلاؤڈ بیک اپ' },
    enabled: { en: 'Automatically back up to the cloud', ur: 'کلاؤڈ پر خودکار بیک اپ' },
    scheduledTimes: { en: 'Daily Backup Times', ur: 'روزانہ بیک اپ کے اوقات' },
    addTime: { en: 'Add Time', ur: 'وقت شامل کریں' },
    lastBackup: { en: 'Last cloud backup', ur: 'آخری کلاؤڈ بیک اپ' },
    neverBackedUp: { en: 'Never backed up yet', ur: 'ابھی تک کوئی بیک اپ نہیں ہوا' },
    backupNow: { en: 'Back Up to Cloud Now', ur: 'ابھی کلاؤڈ پر بیک اپ کریں' },
    backingUp: { en: 'Uploading…', ur: 'اپ لوڈ ہو رہا ہے…' },
    backupSuccess: { en: 'Cloud backup uploaded', ur: 'کلاؤڈ بیک اپ اپ لوڈ ہو گیا' },
    backupFailed: { en: 'Cloud backup failed', ur: 'کلاؤڈ بیک اپ ناکام ہوا' },
    restoreFromCloud: { en: 'Restore from Cloud…', ur: 'کلاؤڈ سے بحال کریں…' },
    restoreConfirmTitle: { en: 'Restore from your cloud backup?', ur: 'کیا اپنے کلاؤڈ بیک اپ سے بحال کریں؟' },
    restoreConfirmBody: {
      en: 'All current data will be replaced with your latest cloud backup. A safety copy of your current data will be created first, and the app will restart automatically.',
      ur: 'تمام موجودہ ڈیٹا آپ کے تازہ ترین کلاؤڈ بیک اپ سے تبدیل ہو جائے گا۔ پہلے آپ کے موجودہ ڈیٹا کی ایک حفاظتی کاپی بنائی جائے گی، اور ایپ خود بخود دوبارہ شروع ہو جائے گی۔'
    },
    missedTitle: { en: "Today's cloud backup hasn't run yet", ur: 'آج کا کلاؤڈ بیک اپ ابھی تک نہیں ہوا' },
    missedBody: {
      en: 'A scheduled backup time has passed without a successful upload. Back up now to keep your cloud copy current.',
      ur: 'مقررہ بیک اپ کا وقت گزر چکا ہے اور کوئی کامیاب اپ لوڈ نہیں ہوا۔ اپنی کلاؤڈ کاپی کو تازہ رکھنے کے لیے ابھی بیک اپ کریں۔'
    }
  },
  googleDrive: {
    title: { en: 'Google Drive', ur: 'گوگل ڈرائیو' },
    hint: {
      en: 'Connect your own Google Drive to enable cloud backups. Backups upload only to a private folder in this account — nothing else in your Drive is ever accessed.',
      ur: 'کلاؤڈ بیک اپ فعال کرنے کے لیے اپنی گوگل ڈرائیو منسلک کریں۔ بیک اپ صرف اسی اکاؤنٹ کے ایک نجی فولڈر میں اپ لوڈ ہوتے ہیں — آپ کی ڈرائیو میں کسی اور چیز تک رسائی نہیں کی جاتی۔'
    },
    connectedAs: { en: 'Connected as', ur: 'بطور منسلک' },
    notConnected: { en: 'Not connected', ur: 'منسلک نہیں' },
    disconnected: {
      en: 'Google Drive disconnected — please reconnect',
      ur: 'گوگل ڈرائیو منقطع ہو گئی — براہ کرم دوبارہ منسلک کریں'
    },
    connect: { en: 'Connect Google Drive', ur: 'گوگل ڈرائیو منسلک کریں' },
    reconnect: { en: 'Reconnect Google Drive', ur: 'گوگل ڈرائیو دوبارہ منسلک کریں' },
    connecting: { en: 'Waiting for Google sign-in…', ur: 'گوگل سائن ان کا انتظار ہے…' },
    disconnect: { en: 'Disconnect', ur: 'منقطع کریں' },
    connectFailed: { en: 'Could not connect Google Drive', ur: 'گوگل ڈرائیو منسلک نہیں ہو سکی' }
  },
  activity: {
    title: { en: 'Activity Timeline', ur: 'سرگرمی کی ٹائم لائن' },
    searchPlaceholder: { en: 'Search activity…', ur: 'سرگرمی تلاش کریں…' },
    entityType: { en: 'Entity', ur: 'قسم' },
    actionType: { en: 'Action', ur: 'عمل' },
    allEntityTypes: { en: 'All Entities', ur: 'تمام اقسام' },
    allActionTypes: { en: 'All Actions', ur: 'تمام اعمال' },
    entityCustomer: { en: 'Customer', ur: 'گاہک' },
    entityRepair: { en: 'Repair', ur: 'مرمت' },
    entityExpense: { en: 'Expense', ur: 'اخراجات' },
    entityAuth: { en: 'Login/Logout', ur: 'لاگ ان/لاگ آؤٹ' },
    entityBackup: { en: 'Backup', ur: 'بیک اپ' },
    entityUdhaar: { en: 'Udhaar', ur: 'ادھار' },
    entitySystem: { en: 'System', ur: 'نظام' },
    actionCreate: { en: 'Created', ur: 'بنایا گیا' },
    actionUpdate: { en: 'Updated', ur: 'اپ ڈیٹ کیا گیا' },
    actionDelete: { en: 'Deleted', ur: 'حذف کیا گیا' },
    actionStatusChange: { en: 'Status Changed', ur: 'حیثیت تبدیل ہوئی' },
    actionDeliveryDateExtended: { en: 'Delivery Date Extended', ur: 'ڈیلیوری کی تاریخ میں توسیع ہوئی' },
    actionUdhaarSettlementRecorded: { en: 'Udhaar Settlement Recorded', ur: 'ادھار کی ادائیگی درج ہوئی' },
    actionUdhaarDueDateExtended: { en: 'Udhaar Due Date Extended', ur: 'ادھار کی تاریخ میں توسیع ہوئی' },
    actionPaymentRecorded: { en: 'Payment Recorded', ur: 'ادائیگی درج ہوئی' },
    actionReceiptPrinted: { en: 'Receipt Printed', ur: 'رسید پرنٹ ہوئی' },
    actionReceiptExported: { en: 'Receipt Exported', ur: 'رسید محفوظ ہوئی' },
    actionLogin: { en: 'Logged In', ur: 'لاگ ان ہوا' },
    actionLogout: { en: 'Logged Out', ur: 'لاگ آؤٹ ہوا' },
    actionBackupCreated: { en: 'Backup Created', ur: 'بیک اپ بنایا گیا' },
    actionBackupFailed: { en: 'Backup Failed', ur: 'بیک اپ ناکام ہوا' },
    actionSafetyBackupCreated: { en: 'Safety Backup Created', ur: 'حفاظتی بیک اپ بنایا گیا' },
    actionRestoreInitiated: { en: 'Restore Started', ur: 'بحالی شروع ہوئی' },
    noResults: { en: 'No matching activity found', ur: 'کوئی مماثل سرگرمی نہیں ملی' },
    loadingMore: { en: 'Loading more…', ur: 'مزید لوڈ ہو رہا ہے…' },
    endOfHistory: { en: 'No more activity to show', ur: 'مزید سرگرمی نہیں' }
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
      en: 'Repair orders for this customer will show up here.',
      ur: 'اس گاہک کے مرمت آرڈر یہاں نظر آئیں گے۔'
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
  dashboard: {
    todaysRepairs: { en: "Today's Repairs", ur: 'آج کی مرمتیں' },
    pendingRepairs: { en: 'Pending Repairs', ur: 'زیر التواء مرمتیں' },
    readyForPickup: { en: 'Ready for Pickup', ur: 'وصولی کے لیے تیار' },
    todaysRevenue: { en: "Today's Revenue", ur: 'آج کی آمدنی' },
    todaysProfit: { en: "Today's Profit", ur: 'آج کا منافع' },
    monthlyRevenue: { en: 'Monthly Revenue', ur: 'ماہانہ آمدنی' },
    monthlyProfit: { en: 'Monthly Profit', ur: 'ماہانہ منافع' },
    quickActions: { en: 'Quick Actions', ur: 'فوری اقدامات' },
    viewReports: { en: 'View Reports', ur: 'رپورٹس دیکھیں' },
    todaysDeliveries: { en: "Today's Deliveries", ur: 'آج کی ڈیلیوریاں' },
    noDeliveriesToday: { en: 'No deliveries due today', ur: 'آج کوئی ڈیلیوری مقررہ نہیں' },
    recentRepairs: { en: 'Recent Repairs', ur: 'حالیہ مرمتیں' },
    recentActivity: { en: 'Recent Activity', ur: 'حالیہ سرگرمی' },
    noActivityYet: { en: 'No activity yet', ur: 'ابھی کوئی سرگرمی نہیں' },
    viewAll: { en: 'View All', ur: 'سب دیکھیں' },
    monthlyExpenses: { en: 'Monthly Expenses', ur: 'ماہانہ اخراجات' },
    netProfit: { en: 'Net Profit', ur: 'خالص منافع' },
    reminderRentTitle: {
      en: "You haven't logged Rent for this month yet",
      ur: 'آپ نے اس مہینے کرایہ درج نہیں کیا'
    },
    reminderElectricityTitle: {
      en: "You haven't logged Electricity for this month yet",
      ur: 'آپ نے اس مہینے بجلی کا بل درج نہیں کیا'
    },
    logNow: { en: 'Log Now', ur: 'ابھی درج کریں' },
    overdueDeliveries: { en: 'Overdue Deliveries', ur: 'تاخیر سے ڈیلیوریاں' },
    overdueDeliveriesBody: {
      en: 'These repairs are past their estimated delivery date and still need action.',
      ur: 'ان مرمتوں کی متوقع ڈیلیوری تاریخ گزر چکی ہے اور ابھی بھی کارروائی درکار ہے۔'
    },
    extendDeliveryDate: { en: 'Extend Delivery Date', ur: 'ڈیلیوری کی تاریخ بڑھائیں' },
    newDeliveryDate: { en: 'New delivery date', ur: 'نئی ڈیلیوری کی تاریخ' },
    extendBy1Day: { en: '+1 day', ur: '+1 دن' },
    extendBy3Days: { en: '+3 days', ur: '+3 دن' },
    extendBy1Week: { en: '+1 week', ur: '+1 ہفتہ' },
    updateDate: { en: 'Update Date', ur: 'تاریخ اپ ڈیٹ کریں' }
  },
  repairs: {
    addNew: { en: 'New Repair Order', ur: 'نیا مرمت آرڈر' },
    editRepair: { en: 'Edit Repair Order', ur: 'مرمت آرڈر میں ترمیم کریں' },
    searchPlaceholder: {
      en: 'Search by customer, phone, device, IMEI, or ID',
      ur: 'گاہک، فون، ڈیوائس، آئی ایم ای آئی یا آئی ڈی سے تلاش کریں'
    },
    customer: { en: 'Customer', ur: 'گاہک' },
    deviceBrand: { en: 'Device Brand', ur: 'ڈیوائس برانڈ' },
    deviceModel: { en: 'Device Model', ur: 'ڈیوائس ماڈل' },
    issue: { en: 'Issue', ur: 'مسئلہ' },
    accessories: { en: 'Accessories', ur: 'لوازمات' },
    imei: { en: 'IMEI', ur: 'آئی ایم ای آئی' },
    estimatedDeliveryDate: { en: 'Estimated Delivery Date', ur: 'متوقع ڈیلیوری تاریخ' },
    deliveryTime: { en: 'Delivery Time', ur: 'ڈیلیوری وقت' },
    costPrice: { en: 'Cost Price', ur: 'لاگت قیمت' },
    repairPrice: { en: 'Repair Price', ur: 'مرمت قیمت' },
    advanceAmount: { en: 'Advance Amount', ur: 'ایڈوانس رقم' },
    remainingBalance: { en: 'Remaining Balance', ur: 'باقی رقم' },
    priority: { en: 'Priority', ur: 'ترجیح' },
    priorityLow: { en: 'Low', ur: 'کم' },
    priorityNormal: { en: 'Normal', ur: 'عام' },
    priorityHigh: { en: 'High', ur: 'زیادہ' },
    notes: { en: 'Notes', ur: 'نوٹس' },
    status: { en: 'Status', ur: 'حالت' },
    statusPending: { en: 'Pending', ur: 'زیر التواء' },
    statusCompleted: { en: 'Completed', ur: 'مکمل' },
    statusDelivered: { en: 'Delivered', ur: 'ڈیلیور ہو گیا' },
    statusCancelled: { en: 'Cancelled', ur: 'منسوخ' },
    changeStatus: { en: 'Change Status', ur: 'حالت تبدیل کریں' },
    markCompleted: { en: 'Mark as Completed', ur: 'مکمل نشان زد کریں' },
    markDelivered: { en: 'Mark as Delivered', ur: 'ڈیلیور شدہ نشان زد کریں' },
    revertToPending: { en: 'Revert to Pending', ur: 'زیر التواء پر واپس کریں' },
    cancelOrder: { en: 'Cancel Order', ur: 'آرڈر منسوخ کریں' },
    statusLocked: { en: 'This repair is locked — no further changes allowed', ur: 'یہ مرمت مقفل ہے — مزید تبدیلی ممکن نہیں' },
    printReceipt: { en: 'Print Receipt', ur: 'رسید پرنٹ کریں' },
    recordPayment: { en: 'Record Payment', ur: 'ادائیگی درج کریں' },
    viewCustomerProfile: { en: 'View Customer Profile', ur: 'گاہک کی پروفائل دیکھیں' },
    filterStatus: { en: 'Status', ur: 'حالت' },
    filterBrand: { en: 'Brand', ur: 'برانڈ' },
    filterDateRange: { en: 'Date Range', ur: 'تاریخ کی حد' },
    allStatuses: { en: 'All Statuses', ur: 'تمام حالتیں' },
    allBrands: { en: 'All Brands', ur: 'تمام برانڈز' },
    dateToday: { en: 'Today', ur: 'آج' },
    dateThisWeek: { en: 'This Week', ur: 'اس ہفتے' },
    dateThisMonth: { en: 'This Month', ur: 'اس مہینے' },
    dateCustom: { en: 'Custom', ur: 'اپنی مرضی' },
    dateAll: { en: 'All Time', ur: 'ہر وقت' },
    dateFrom: { en: 'From', ur: 'سے' },
    dateTo: { en: 'To', ur: 'تک' },
    emptyTitle: { en: 'No repair orders yet', ur: 'ابھی کوئی مرمت آرڈر نہیں' },
    emptyBody: {
      en: 'Create your first repair order to get started.',
      ur: 'شروع کرنے کے لیے اپنا پہلا مرمت آرڈر بنائیں۔'
    },
    noMatches: { en: 'No matching repair orders', ur: 'کوئی مماثل مرمت آرڈر نہیں' },
    save: { en: 'Save', ur: 'محفوظ کریں' },
    cancel: { en: 'Cancel', ur: 'منسوخ کریں' },
    edit: { en: 'Edit', ur: 'ترمیم کریں' },
    delete: { en: 'Delete', ur: 'حذف کریں' },
    deleteConfirmTitle: { en: 'Delete this repair order?', ur: 'کیا اس مرمت آرڈر کو حذف کریں؟' },
    deleteConfirmBody: {
      en: 'It will no longer appear in repair lists or search.',
      ur: 'یہ اب مرمت کی فہرست یا تلاش میں نظر نہیں آئے گا۔'
    },
    notFound: { en: 'Repair order not found', ur: 'مرمت آرڈر نہیں ملا' },
    backToList: { en: 'Back to repair orders', ur: 'مرمت آرڈرز کی فہرست پر واپس جائیں' }
  },
  payments: {
    recordPayment: { en: 'Record Payment', ur: 'ادائیگی درج کریں' },
    amount: { en: 'Amount', ur: 'رقم' },
    paymentType: { en: 'Payment Type', ur: 'ادائیگی کی قسم' },
    typeAdvance: { en: 'Advance', ur: 'ایڈوانس' },
    typePartial: { en: 'Partial', ur: 'جزوی' },
    typeFull: { en: 'Full', ur: 'مکمل' },
    paymentDate: { en: 'Payment Date', ur: 'ادائیگی کی تاریخ' },
    notes: { en: 'Notes', ur: 'نوٹس' },
    save: { en: 'Save Payment', ur: 'ادائیگی محفوظ کریں' },
    cancel: { en: 'Cancel', ur: 'منسوخ کریں' },
    paymentHistory: { en: 'Payment History', ur: 'ادائیگیوں کی تاریخ' },
    noPaymentsYet: { en: 'No payments recorded yet', ur: 'ابھی تک کوئی ادائیگی درج نہیں' },
    overpaymentTitle: { en: 'Amount exceeds remaining balance', ur: 'رقم باقی رقم سے زیادہ ہے' },
    overpaymentBody: {
      en: 'This payment is more than what is currently owed. Record it anyway?',
      ur: 'یہ ادائیگی موجودہ واجب الادا رقم سے زیادہ ہے۔ کیا پھر بھی درج کریں؟'
    },
    recordAnyway: { en: 'Record Anyway', ur: 'پھر بھی درج کریں' },
    searchPlaceholder: {
      en: 'Search by customer, phone, or device',
      ur: 'گاہک، فون یا ڈیوائس سے تلاش کریں'
    },
    allTypes: { en: 'All Types', ur: 'تمام اقسام' },
    runningTotal: { en: 'Total', ur: 'مجموعی رقم' },
    emptyBody: {
      en: 'Payments recorded against repairs will show up here.',
      ur: 'مرمتوں کے خلاف درج کی گئی ادائیگیاں یہاں نظر آئیں گی۔'
    },
    noMatches: { en: 'No matching payments', ur: 'کوئی مماثل ادائیگی نہیں ملی' }
  },
  expenses: {
    addNew: { en: 'Add Expense', ur: 'خرچہ شامل کریں' },
    category: { en: 'Category', ur: 'قسم' },
    categoryRent: { en: 'Rent', ur: 'کرایہ' },
    categoryElectricity: { en: 'Electricity', ur: 'بجلی' },
    categorySupplies: { en: 'Supplies', ur: 'سامان' },
    categorySalary: { en: 'Salary', ur: 'تنخواہ' },
    categoryMaintenance: { en: 'Maintenance', ur: 'دیکھ بھال' },
    categoryPersonalWithdrawal: { en: 'Personal Withdrawal', ur: 'ذاتی نکاسی' },
    categoryOther: { en: 'Other', ur: 'دیگر' },
    categoryCustom: { en: 'Custom Category…', ur: 'اپنی قسم…' },
    customCategoryLabel: { en: 'Custom Category Name', ur: 'اپنی قسم کا نام' },
    amount: { en: 'Amount', ur: 'رقم' },
    description: { en: 'Description', ur: 'تفصیل' },
    expenseDate: { en: 'Expense Date', ur: 'خرچ کی تاریخ' },
    isRecurring: { en: 'Recurring Monthly', ur: 'ماہانہ تکراری' },
    recurringMonth: { en: 'Recurring Month', ur: 'تکراری مہینہ' },
    save: { en: 'Save Expense', ur: 'خرچہ محفوظ کریں' },
    cancel: { en: 'Cancel', ur: 'منسوخ کریں' },
    allCategories: { en: 'All Categories', ur: 'تمام اقسام' },
    runningTotal: { en: 'Total', ur: 'مجموعی رقم' },
    emptyTitle: { en: 'No expenses yet', ur: 'ابھی کوئی خرچہ نہیں' },
    emptyBody: {
      en: 'Add your first expense to get started.',
      ur: 'شروع کرنے کے لیے اپنا پہلا خرچہ شامل کریں۔'
    },
    noMatches: { en: 'No matching expenses', ur: 'کوئی مماثل خرچہ نہیں' }
  },
  udhaar: {
    addNew: { en: 'Add Udhaar', ur: 'ادھار شامل کریں' },
    receivables: { en: 'Receivables', ur: 'وصولی' },
    payables: { en: 'Payables', ur: 'قابل ادائیگی' },
    totalReceivables: { en: 'Total Receivables', ur: 'کل وصولی' },
    totalPayables: { en: 'Total Payables', ur: 'کل قابل ادائیگی' },
    direction: { en: 'Direction', ur: 'سمت' },
    directionReceivable: { en: 'Receivable — Customer Owes You', ur: 'وصولی — گاہک آپ کا واجب الادا ہے' },
    directionPayable: { en: 'Payable — You Owe Someone', ur: 'قابل ادائیگی — آپ کسی کے واجب الادا ہیں' },
    person: { en: 'Person', ur: 'شخص' },
    existingCustomer: { en: 'Existing Customer', ur: 'موجودہ گاہک' },
    someoneElse: { en: 'Someone Else (Not a Customer)', ur: 'کوئی اور (گاہک نہیں)' },
    personName: { en: 'Name', ur: 'نام' },
    personPhone: { en: 'Phone (optional)', ur: 'فون نمبر (اختیاری)' },
    amount: { en: 'Amount', ur: 'رقم' },
    dueDate: { en: 'Due Date', ur: 'ادائیگی کی تاریخ' },
    dueDateOptionalField: { en: 'Due Date (optional)', ur: 'ادائیگی کی تاریخ (اختیاری)' },
    newDueDate: { en: 'New due date', ur: 'نئی ادائیگی کی تاریخ' },
    noDueDate: { en: 'No due date', ur: 'کوئی تاریخ مقرر نہیں' },
    notes: { en: 'Notes', ur: 'نوٹس' },
    save: { en: 'Save', ur: 'محفوظ کریں' },
    cancel: { en: 'Cancel', ur: 'منسوخ کریں' },
    remainingBalance: { en: 'Remaining Balance', ur: 'باقی رقم' },
    status: { en: 'Status', ur: 'حیثیت' },
    statusPending: { en: 'Pending', ur: 'زیر التواء' },
    statusPartiallySettled: { en: 'Partially Settled', ur: 'جزوی ادائیگی' },
    statusSettled: { en: 'Settled', ur: 'ادا شدہ' },
    allStatuses: { en: 'All Statuses', ur: 'تمام حیثیتیں' },
    filterOverdueOnly: { en: 'Due Date', ur: 'ادائیگی کی تاریخ' },
    filterAll: { en: 'All', ur: 'تمام' },
    filterOverdue: { en: 'Overdue', ur: 'تاخیر شدہ' },
    filterUpcoming: { en: 'Upcoming', ur: 'آئندہ' },
    searchPlaceholder: { en: 'Search by name or phone', ur: 'نام یا فون نمبر سے تلاش کریں' },
    recordSettlement: { en: 'Record Settlement', ur: 'ادائیگی درج کریں' },
    settlementAmount: { en: 'Settlement Amount', ur: 'ادائیگی کی رقم' },
    settlementDate: { en: 'Settlement Date', ur: 'ادائیگی کی تاریخ' },
    extendDueDate: { en: 'Extend Due Date', ur: 'تاریخ بڑھائیں' },
    emptyTitle: { en: 'No Udhaar entries yet', ur: 'ابھی کوئی ادھار درج نہیں' },
    emptyBody: {
      en: 'Track money owed to you or by you here.',
      ur: 'یہاں اپنی وصولی یا واجب الادا رقم کو ٹریک کریں۔'
    },
    noMatches: { en: 'No matching Udhaar entries', ur: 'کوئی مماثل ادھار نہیں ملا' },
    overdueTitle: { en: 'Overdue Udhaar', ur: 'تاخیر شدہ ادھار' },
    overdueBody: {
      en: 'These entries are past their due date and still not fully settled.',
      ur: 'ان کی ادائیگی کی تاریخ گزر چکی ہے اور ابھی تک مکمل ادائیگی نہیں ہوئی۔'
    },
    trackBalancePromptTitle: { en: 'Unpaid Balance on Delivery', ur: 'ڈیلیوری پر غیر ادا شدہ رقم' },
    trackBalancePromptBody: {
      en: 'This repair still has an unpaid balance. Track it as Udhaar so it isn’t forgotten?',
      ur: 'اس مرمت کی رقم ابھی تک ادا نہیں ہوئی۔ کیا اسے بھول جانے سے بچانے کے لیے ادھار کے طور پر درج کریں؟'
    },
    trackAsUdhaar: { en: 'Yes, Track It', ur: 'ہاں، درج کریں' },
    skipTracking: { en: 'No, Just Deliver', ur: 'نہیں، صرف ڈیلیور کریں' }
  },
  reports: {
    dateRangeLabel: { en: 'Report Period', ur: 'رپورٹ کی مدت' },
    daily: { en: 'Daily', ur: 'روزانہ' },
    weekly: { en: 'Weekly', ur: 'ہفتہ وار' },
    monthly: { en: 'Monthly', ur: 'ماہانہ' },
    yearly: { en: 'Yearly', ur: 'سالانہ' },
    custom: { en: 'Custom', ur: 'اپنی مرضی' },
    selectCustomRange: {
      en: 'Select a custom date range to generate this report.',
      ur: 'یہ رپورٹ بنانے کے لیے اپنی مرضی کی تاریخ کی حد منتخب کریں۔'
    },
    totalRevenue: { en: 'Total Revenue', ur: 'کل آمدنی' },
    totalRepairProfit: { en: 'Total Repair Profit', ur: 'کل مرمت منافع' },
    totalExpenses: { en: 'Total Expenses', ur: 'کل اخراجات' },
    netProfit: { en: 'Net Profit', ur: 'خالص منافع' },
    expensesByCategory: { en: 'Expenses by Category', ur: 'قسم کے لحاظ سے اخراجات' },
    topBrands: { en: 'Top Brands', ur: 'اہم برانڈز' },
    topModels: { en: 'Top Models', ur: 'اہم ماڈلز' },
    commonRepairTypes: { en: 'Common Repair Types', ur: 'عام مرمت کی اقسام' },
    repairsByStatus: { en: 'Repairs by Status', ur: 'حالت کے لحاظ سے مرمتیں' },
    repairCount: { en: 'Repairs', ur: 'مرمتیں' },
    exportPdf: { en: 'Export PDF', ur: 'پی ڈی ایف برآمد کریں' },
    print: { en: 'Print', ur: 'پرنٹ کریں' },
    noDataForPeriod: { en: 'No data for this period', ur: 'اس مدت کے لیے کوئی ڈیٹا نہیں' },
    shopNamePlaceholder: { en: 'Your Shop Name', ur: 'آپ کی دکان کا نام' },
    reportGeneratedOn: { en: 'Generated on', ur: 'تیار کردہ بتاریخ' }
  },
  analytics: {
    revenueTrend: { en: 'Revenue Trend', ur: 'آمدنی کا رجحان' },
    profitTrend: { en: 'Profit Trend', ur: 'منافع کا رجحان' },
    repairVolume: { en: 'Repair Volume', ur: 'مرمت کا حجم' },
    newCustomers: { en: 'New Customers', ur: 'نئے گاہک' },
    repeatCustomerRate: { en: 'Repeat Customer Rate', ur: 'دہرائے جانے والے گاہکوں کی شرح' },
    repeatCustomerRateBody: {
      en: 'of customers with at least one repair have come back for more than one',
      ur: 'کم از کم ایک مرمت کروانے والے گاہکوں میں سے کتنے فیصد ایک سے زیادہ بار آئے'
    },
    topCustomers: { en: 'Top Customers', ur: 'اہم گاہک' },
    brandBreakdown: { en: 'Repairs by Brand', ur: 'برانڈ کے لحاظ سے مرمتیں' },
    created: { en: 'Created', ur: 'شروع شدہ' },
    granularity: { en: 'View', ur: 'ملاحظہ' },
    noDataYet: { en: 'Not enough data yet', ur: 'ابھی کافی ڈیٹا نہیں' }
  },
  receipts: {
    title: { en: 'Repair Receipt', ur: 'مرمت کی رسید' },
    preview: { en: 'Receipt Preview', ur: 'رسید کا معائنہ' },
    receiptNo: { en: 'Receipt No.', ur: 'رسید نمبر' },
    device: { en: 'Device', ur: 'آلہ' },
    date: { en: 'Date', ur: 'تاریخ' },
    amountPaid: { en: 'Amount Paid', ur: 'ادا شدہ رقم' },
    qrComingSoon: { en: 'QR Code (coming soon)', ur: 'کیو آر کوڈ (جلد آ رہا ہے)' },
    thankYou: { en: 'Thank you for your business!', ur: 'آپ کے کاروبار کا شکریہ!' },
    close: { en: 'Close', ur: 'بند کریں' },
    printedConfirmation: { en: 'Receipt sent to printer', ur: 'رسید پرنٹر کو بھیج دی گئی' }
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
