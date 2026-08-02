/**
 * Canonical form for phone numbers: digits only, no spaces/dashes/parens.
 * Applied on every write and every duplicate lookup so "0300-1234567" and
 * "03001234567" are always treated as the same number — see Phase 4
 * write-up for why this beats fuzzy/typo matching for duplicate detection.
 */
export function normalizePhone(input: string): string {
  return input.replace(/[^\d]/g, '')
}
