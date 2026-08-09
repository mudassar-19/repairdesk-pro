/**
 * Backend (main-process) input validation — the second, non-bypassable layer
 * behind the renderer form checks. These run in the IPC handlers that the
 * renderer calls, so a malformed value can never be persisted even if it
 * somehow gets past (or around) the UI. Deliberately NOT placed in the
 * repositories: dev self-tests and seed scripts write intentionally synthetic
 * marker phones (e.g. "selftest-…") straight through the repository, which is
 * fine because those never come from user input and never touch these handlers.
 *
 * Kept as a tiny standalone module (no renderer import — main and renderer
 * can't share a module across the Electron process boundary), mirroring the
 * renderer's shared/lib/phone.ts rules exactly.
 */
import { todayLocalDateString } from './date'

/** Pakistani mobile numbers: exactly 11 digits, starting with "03". */
export function isValidMobilePhone(value: string): boolean {
  return /^03\d{9}$/.test(value)
}

/** IMEI is optional; when present it must be exactly 15 digits (the GSM standard). */
export function isValidImei(value: string): boolean {
  return value === '' || /^\d{15}$/.test(value)
}

/** At least one Unicode letter in ANY script (so Urdu/Arabic names pass, "12345"/"!!!" don't). */
export function hasLetter(value: string): boolean {
  return /\p{L}/u.test(value)
}

/** Throws a clear error if `phone` isn't a well-formed mobile number. */
export function assertValidMobilePhone(phone: string): void {
  if (!isValidMobilePhone(phone)) {
    throw new Error('Invalid phone number: must be 11 digits starting with 03.')
  }
}

/** Throws if a (non-empty) IMEI isn't exactly 15 digits. */
export function assertValidImei(imei: string | null | undefined): void {
  if (imei != null && imei !== '' && !isValidImei(imei)) {
    throw new Error('Invalid IMEI: must be exactly 15 digits.')
  }
}

/** Throws if the booking advance exceeds the total/repair price (would create a negative balance). */
export function assertAdvanceWithinPrice(advanceAmount: number, repairPrice: number): void {
  if (advanceAmount > repairPrice) {
    throw new Error('Advance amount cannot exceed the total price.')
  }
}

/** Throws if a monetary value is negative or not a finite number. Zero is allowed (e.g. free/warranty repairs). */
export function assertNonNegativeMoney(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} cannot be negative.`)
  }
}

/** Throws if an amount that must represent real money moved is not strictly > 0. */
export function assertPositiveAmount(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`)
  }
}

/** Throws if a required text value is empty/whitespace-only. */
export function assertNonEmpty(value: string | null | undefined, label: string): void {
  if (!value || value.trim() === '') {
    throw new Error(`${label} is required.`)
  }
}

/**
 * Throws if a 'YYYY-MM-DD' date string is AFTER today (local). Used for
 * money-movement dates (payment/settlement) and expense date: money received
 * or spent can't be dated in the future. Empty/undefined is allowed — the
 * caller enforces "required" separately where needed. Lexicographic string
 * comparison is correct for zero-padded ISO date strings.
 */
export function assertNotFutureDate(dateStr: string | null | undefined, label: string): void {
  if (!dateStr) return
  if (dateStr > todayLocalDateString()) {
    throw new Error(`${label} cannot be in the future.`)
  }
}
