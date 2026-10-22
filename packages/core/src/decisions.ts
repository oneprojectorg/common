/**
 * Why an admin rejected a proposal. Declaration order is the order the reject
 * dialog offers them in. No pg enum behind it: neither the reason nor the note
 * is persisted yet — both exist to be delivered in the rejection email.
 *
 * Lives here because three packages need the same values and none of them can
 * depend on the others: `@op/common` owns the mutation and the dialog copy,
 * `@op/events` validates the notification payload, and `@op/emails` renders the
 * reader-facing label. `@op/core` is the only package all three already depend
 * on. Kept in its own module rather than `config.ts` so importing it never
 * pulls `p-queue` and the tailwind palette along with it.
 */
export enum RejectionReason {
  INELIGIBLE = 'ineligible',
  DUPLICATE = 'duplicate',
  OFF_TOPIC = 'off-topic',
  INFEASIBLE = 'infeasible',
}
