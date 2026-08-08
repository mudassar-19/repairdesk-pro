import type { BilingualString } from '@shared/i18n'

/**
 * Quick-select common repair issues (Part J#14), bilingual. Data, not a single
 * dictionary string, so it lives here rather than in the dictionary (whose
 * leaves are all single { en, ur } strings). Tapping a chip fills the free-text
 * Issue field; the user can still type anything else.
 */
export const commonIssues: BilingualString[] = [
  { en: 'Screen Replacement', ur: 'اسکرین کی تبدیلی' },
  { en: 'Battery Replacement', ur: 'بیٹری کی تبدیلی' },
  { en: 'Charging Port', ur: 'چارجنگ پورٹ' },
  { en: 'Water Damage', ur: 'پانی کا نقصان' },
  { en: 'Software Issue', ur: 'سافٹ ویئر مسئلہ' },
  { en: 'Speaker / Mic', ur: 'اسپیکر / مائیک' }
]
