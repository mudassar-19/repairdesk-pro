export interface BilingualString {
  en: string
  ur: string
}

/** Recursive dictionary: every leaf must be a BilingualString. */
export type Dictionary = {
  [key: string]: BilingualString | Dictionary
}
