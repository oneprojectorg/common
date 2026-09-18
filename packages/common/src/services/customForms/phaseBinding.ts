import { db } from '@op/db/client';
import type { TransactionType } from '@op/db/client';
import { sql } from 'drizzle-orm';

import { ValidationError } from '../../utils';
import type { CustomFormProcessContext } from './customFormAuth';
import { getEffectiveFormPhase } from './utils';

/**
 * Runs a form write inside the transaction that owns the phase binding: the
 * profile's forms are locked, the target phase is proven free, and only then
 * does `write` run. The single entry point for create and update, so neither
 * can reach the insert without holding the lock that makes the check mean
 * anything.
 */
export const writeWithPhaseLock = async <TResult>({
  process,
  phaseId,
  excludeFormId,
  write,
}: {
  process: CustomFormProcessContext;
  phaseId: string;
  excludeFormId?: string;
  write: (tx: TransactionType) => Promise<TResult>;
}): Promise<TResult> =>
  db.transaction(async (tx) => {
    await lockProfileForms({ tx, profileId: process.profileId });
    await assertPhaseAvailable({ tx, process, phaseId, excludeFormId });

    return write(tx);
  });

/**
 * Serializes concurrent form writes on one profile for the transaction.
 *
 * `x-phase` lives inside the `schema` jsonb, so Postgres has no unique index to
 * enforce one-form-per-phase for us. Two admins saving a form for the same
 * phase at the same moment would both read an empty phase and both insert;
 * `getCustomFormForProfile` would then return whichever row came back first.
 */
export const lockProfileForms = async ({
  tx,
  profileId,
}: {
  tx: TransactionType;
  profileId: string;
}): Promise<void> => {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${'custom_forms:' + profileId}))`,
  );
};

/**
 * Refuses a phase that is not configured on the process, or that another live
 * form already occupies. Caller holds {@link lockProfileForms}.
 *
 * @param excludeFormId - The form being updated, so re-saving it under its own
 *   phase isn't read as a collision with itself.
 */
export const assertPhaseAvailable = async ({
  tx,
  process,
  phaseId,
  excludeFormId,
}: {
  tx: TransactionType;
  process: CustomFormProcessContext;
  phaseId: string;
  excludeFormId?: string;
}): Promise<void> => {
  if (!process.phaseIds.includes(phaseId)) {
    throw new ValidationError('This decision process has no such phase', {
      'x-phase': `"${phaseId}" is not a phase of this decision process`,
    });
  }

  const forms = await tx.query.customForms.findMany({
    where: {
      profileId: process.profileId,
      deletedAt: { isNull: true },
    },
    columns: { id: true, schema: true },
  });

  const conflict = forms.find(
    (form) =>
      form.id !== excludeFormId &&
      getEffectiveFormPhase({
        schema: form.schema,
        initialPhaseId: process.initialPhaseId,
      }) === phaseId,
  );

  if (conflict) {
    throw new ValidationError('This phase already has a form', {
      'x-phase': 'Each phase can have only one form',
    });
  }
};
