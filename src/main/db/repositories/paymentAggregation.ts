import { and, eq, ne } from 'drizzle-orm'
import { repairs } from '../schema'

/**
 * The single source of truth for "does this payment count as real money?"
 *
 * A payment only contributes to revenue / profit / customer-spend aggregates
 * when its parent repair is BOTH not soft-deleted AND not cancelled. This is
 * the root-cause fix for the phantom-revenue bug: a payment carries its own
 * `isDeleted` flag, but that flag is never touched when the parent repair is
 * removed (soft-deleted) or cancelled — so aggregates that filtered on
 * `payments.isDeleted` alone kept counting a deleted/cancelled repair's money
 * forever. Cancelling a repair is therefore a pure, non-destructive,
 * reporting-level reversal (the payment rows are preserved for the audit trail
 * and the Payments-page "Cancelled" badge); this predicate is what makes that
 * reversal take effect consistently in Dashboard, Reports, Analytics and
 * Customer "Total Spent" all at once.
 *
 * INVARIANT: every payment aggregate that joins (or filters) the repairs table
 * MUST AND-in this predicate alongside `eq(payments.isDeleted, false)`. Adding a
 * new money aggregate without it is the exact class of bug this centralises away
 * — see scripts/verifyCancellationReversal.ts for the guard test.
 */
export function activeRepairPaymentCondition() {
  return and(eq(repairs.isDeleted, false), ne(repairs.status, 'cancelled'))
}
