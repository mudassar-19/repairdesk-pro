import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'

/** Mirrors schema.ts's expenseCategoryValues — see repairStatus.ts for why this is duplicated rather than imported. */
export const expenseCategoryValues = [
  'rent',
  'electricity',
  'supplies',
  'salary',
  'maintenance',
  'personal_withdrawal',
  'other'
] as const
export type ExpenseCategory = (typeof expenseCategoryValues)[number]

export const expenseCategoryLabel: Record<ExpenseCategory, BilingualString> = {
  rent: dictionary.expenses.categoryRent,
  electricity: dictionary.expenses.categoryElectricity,
  supplies: dictionary.expenses.categorySupplies,
  salary: dictionary.expenses.categorySalary,
  maintenance: dictionary.expenses.categoryMaintenance,
  personal_withdrawal: dictionary.expenses.categoryPersonalWithdrawal,
  other: dictionary.expenses.categoryOther
}

/** Custom categories (anything not in expenseCategoryValues) display as-is — there's no lookup for arbitrary text. */
export function categoryLabel(category: string): string {
  return (expenseCategoryLabel as Record<string, BilingualString>)[category]?.en ?? category
}
