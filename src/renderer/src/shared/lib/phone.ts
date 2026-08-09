/**
 * Canonical form for phone numbers: digits only, no spaces/dashes/parens.
 * Applied on every write and every duplicate lookup so "0300-1234567" and
 * "03001234567" are always treated as the same number — see Phase 4
 * write-up for why this beats fuzzy/typo matching for duplicate detection.
 */
export function normalizePhone(input: string): string {
  return input.replace(/[^\d]/g, '')
}

/** Pakistani mobile numbers: exactly 11 digits, starting with "03". */
export const PHONE_LENGTH = 11
export const PHONE_HELP = 'Enter an 11-digit mobile number starting with 03 (e.g. 03001234567).'

/**
 * Strip everything that isn't a digit and cap at 11 — for use in input
 * onChange so invalid characters are rejected AS TYPED (the field can never
 * hold a letter, dash, or space), rather than being silently stripped only at
 * save time. Deliberately NOT the same as accepting a short number: the hard
 * isValidMobilePhone check below still blocks saving anything that isn't a
 * complete, well-formed mobile number.
 */
export function sanitizePhoneInput(input: string): string {
  return input.replace(/\D/g, '').slice(0, PHONE_LENGTH)
}

/** True only for a complete, well-formed Pakistani mobile number. */
export function isValidMobilePhone(input: string): boolean {
  return /^03\d{9}$/.test(input)
}

/** Digits only, capped at the 15-digit IMEI length. For input onChange. */
export function sanitizeImeiInput(input: string): string {
  return input.replace(/\D/g, '').slice(0, 15)
}

/** IMEI is optional; when present it must be exactly 15 digits (the GSM standard). */
export const IMEI_HELP = 'IMEI must be exactly 15 digits.'
export function isValidImei(input: string): boolean {
  return input === '' || /^\d{15}$/.test(input)
}

/** A name must contain at least one letter in ANY script (Urdu/Arabic included) — rejects "12345"/"!!!". */
export const NAME_HELP = 'Enter a valid name (letters, not just numbers or symbols).'
export function hasLetter(input: string): boolean {
  return /\p{L}/u.test(input)
}

/** 'YYYY-MM-DD' for today, local calendar (mirrors main/lib/date). */
export function todayLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
