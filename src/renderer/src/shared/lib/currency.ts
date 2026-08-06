/** Scoped to the Receipt and Report PDF — see Phase 15 write-up for why currency display isn't retrofitted across the rest of the app. */
export function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`
}
