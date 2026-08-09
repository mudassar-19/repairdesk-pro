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

/**
 * The Issue field is treated as a comma-separated list of items so the chips
 * can behave as a MULTI-select: a single device can need several repairs at
 * once (screen AND battery). Chip selection state is derived from the field's
 * own text (not a separate store), so manually typing/deleting an item keeps
 * the chips in sync, and any extra custom text the user adds is preserved as
 * its own item. Comparison is case-insensitive/trimmed; chip labels never
 * contain commas, so splitting on "," is safe.
 */
function issueItems(issue: string): string[] {
  return issue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/** True when `chip` is already one of the items in the Issue field. */
export function isIssueChipSelected(issue: string, chip: string): boolean {
  const target = chip.trim().toLowerCase()
  return issueItems(issue).some((item) => item.toLowerCase() === target)
}

/** Toggle `chip` in the Issue field: remove it if present, otherwise append it. */
export function toggleIssueChip(issue: string, chip: string): string {
  const items = issueItems(issue)
  const target = chip.trim().toLowerCase()
  const index = items.findIndex((item) => item.toLowerCase() === target)
  if (index >= 0) items.splice(index, 1)
  else items.push(chip.trim())
  return items.join(', ')
}
