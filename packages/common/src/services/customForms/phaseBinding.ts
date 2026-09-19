import { db, eq } from '@op/db/client';
import type { TransactionType } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { sql } from 'drizzle-orm';

import { NotFoundError, ValidationError } from '../../utils';
import type { CustomFormProcessContext } from './customFormAuth';
import { parseInstancePhases } from './customFormAuth';
import { getEffectiveFormPhase } from './utils';

/** The only write path, so no insert can skip the lock the check depends on. */
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

    // Re-read under the instance's row lock: the phase set was resolved before
    // this transaction, and the process builder can remove a phase in between.
    const phases = await lockInstancePhases({
      tx,
      profileId: process.profileId,
    });

    await assertPhaseAvailable({
      tx,
      process: { ...process, ...phases },
      phaseId,
      excludeFormId,
    });

    return write(tx);
  });

/**
 * The instance's current phase set, holding the row until the transaction ends
 * so a concurrent phase edit waits rather than racing this check.
 */
const lockInstancePhases = async ({
  tx,
  profileId,
}: {
  tx: TransactionType;
  profileId: string;
}) => {
  const [instance] = await tx
    .select({ instanceData: processInstances.instanceData })
    .from(processInstances)
    .where(eq(processInstances.profileId, profileId))
    .for('update')
    .limit(1);

  if (!instance) {
    throw new NotFoundError('Decision process', profileId);
  }

  return parseInstancePhases(instance.instanceData);
};

/**
 * `x-phase` lives inside the `schema` jsonb, so there is no unique index to
 * enforce one-form-per-phase. Without this lock two concurrent saves both read
 * the phase as free and both insert.
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

/** Caller holds {@link lockProfileForms}. */
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
