/**
 * Shared Prisma error translation helpers.
 *
 * When running transactions under Serializable isolation (which is
 * recommended for any multi-row state-machine mutation), PostgreSQL will
 * throw a serialization failure (`P2034` in Prisma) when two transactions
 * would produce a non-serializable outcome. The Prisma runtime also
 * surfaces `P2002` for unique-constraint violations which, in race
 * conditions, usually means "someone else already did the thing you were
 * about to do."
 *
 * These errors leak user-hostile messages like:
 *
 *   "Transaction failed due to a write conflict or a deadlock. Please
 *    retry your transaction."
 *
 * Instead, any service that catches them should call
 * `translateTransactionRaceError(err)` and, if it returns a non-null
 * string, surface that to the user.
 *
 * Originally introduced in pairingService.ts as part of the #103 fix
 * (verified by `test-103.ts` Scenario 20 which deliberately races two
 * concurrent `dissolvePartnership` calls via `Promise.all`). Promoted to
 * this shared module so other services (match submission, chat,
 * notifications, withdrawal admin path) can reuse the same translation
 * without pulling in the full pairingService surface area.
 *
 * Related: `docs/issues/dissections/103-partnership-invite-edge-cases.md`
 * Part 5.1 explains the full reasoning and the Scenario 20 test output
 * that first caught an un-translated P2034 leaking to the caller.
 */

/**
 * Default partnership-oriented messages. Most of the #103 fixes talk about
 * "partnerships" as the domain object, so the default translator returns
 * partnership-flavoured text. For other domains (matches, messages) use
 * `makeTransactionRaceTranslator` to customize the messages.
 */
export interface TransactionRaceMessages {
  /** Message for P2034 — Serializable isolation write conflict. */
  serializationFailure: string;
  /** Message for P2002 — unique constraint violated during race. */
  uniqueConstraintViolation: string;
}

const DEFAULT_PARTNERSHIP_MESSAGES: TransactionRaceMessages = {
  serializationFailure: "Partnership is no longer active",
  uniqueConstraintViolation:
    "A conflicting partnership already exists for this season",
};

/**
 * Translate a raw Prisma/DB transaction error into a friendly string that
 * tells the user their action lost a race (either because another actor
 * already committed a competing state change, or because Postgres's
 * Serializable isolation detected a write conflict and rolled us back).
 *
 * Returns `null` if the error is NOT a known race/conflict code — callers
 * should fall back to their own default message.
 *
 * Uses partnership-oriented wording by default. For other domains, use
 * `makeTransactionRaceTranslator` to build a domain-specific translator.
 *
 * Prisma codes we translate:
 *   - P2034: SerializationFailure (Serializable isolation write conflict)
 *   - P2002: UniqueConstraint (race-driven duplicate)
 */
export function translateTransactionRaceError(err: unknown): string | null {
  return makeTransactionRaceTranslator(DEFAULT_PARTNERSHIP_MESSAGES)(err);
}

/**
 * Build a domain-specific translator with custom messages.
 *
 * Example (match submission):
 *   const translateMatchRaceError = makeTransactionRaceTranslator({
 *     serializationFailure: "This match result was already submitted",
 *     uniqueConstraintViolation: "A duplicate score submission was detected",
 *   });
 */
export function makeTransactionRaceTranslator(
  messages: TransactionRaceMessages,
): (err: unknown) => string | null {
  return (err: unknown): string | null => {
    const code = (err as any)?.code;
    if (code === "P2034") {
      return messages.serializationFailure;
    }
    if (code === "P2002") {
      return messages.uniqueConstraintViolation;
    }
    return null;
  };
}

/**
 * Typeguard helper. Returns true if the error code matches a known
 * transaction-race Prisma error code. Useful when you want to retry
 * instead of translate (e.g. in idempotent background jobs).
 */
export function isTransactionRaceError(err: unknown): boolean {
  const code = (err as any)?.code;
  return code === "P2034" || code === "P2002";
}
