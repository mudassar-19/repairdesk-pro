/**
 * Max lengths for free-text fields. Applied both as the HTML `maxLength`
 * attribute (which blocks typing AND pasting past the limit — the real guard
 * against a 50,000-character paste freezing the app) and as a zod `.max()`
 * rule (a clear message + defense if the attribute is ever bypassed). Generous
 * enough that no real note/name is ever truncated.
 */
export const MAX_NOTES = 2000
export const MAX_ISSUE = 1000
export const MAX_SHORT_TEXT = 200 // names, addresses, accessories, custom category

export const TOO_LONG = (max: number): string => `Too long (maximum ${max} characters).`
