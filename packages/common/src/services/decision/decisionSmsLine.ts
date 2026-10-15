import { db, eq, sql } from '@op/db/client';
import { decisionSmsLines } from '@op/db/schema';
import { logger } from '@op/logging';

import { NotFoundError, ValidationError } from '../../utils';
import {
  normalizePhoneNumber,
  parsePhoneNumber,
} from '../notification/schemas';
import { lockProcessInstance } from './lockProcessInstance';

export interface DecisionSmsLine {
  phoneNumber: string;
}

export const getDecisionSmsLine = async ({
  instanceId,
}: {
  instanceId: string;
}): Promise<DecisionSmsLine | null> => {
  const line = await db.query.decisionSmsLines.findFirst({
    where: { processInstanceId: instanceId },
    columns: { phoneNumber: true },
  });

  return line ?? null;
};

export const setDecisionSmsLine = async ({
  instanceId,
  phoneNumber,
}: {
  instanceId: string;
  phoneNumber: string;
}): Promise<DecisionSmsLine> => {
  const phone = parsePhoneNumber(normalizePhoneNumber(phoneNumber));

  await db.transaction(async (tx) => {
    const locked = await lockProcessInstance({ db: tx, instanceId });
    if (!locked) {
      throw new NotFoundError('Decision instance', instanceId);
    }

    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${'decision_sms_lines:' + phone}))`,
    );

    const holder = await tx.query.decisionSmsLines.findFirst({
      where: { phoneNumber: phone },
      columns: { processInstanceId: true },
    });
    if (holder && holder.processInstanceId !== instanceId) {
      throw new ValidationError('This number is bound to another decision', {
        phoneNumber: 'This number is bound to another decision',
      });
    }

    await tx
      .insert(decisionSmsLines)
      .values({ processInstanceId: instanceId, phoneNumber: phone })
      .onConflictDoUpdate({
        target: decisionSmsLines.processInstanceId,
        set: { phoneNumber: phone },
      });
  });

  logger.info('Decision SMS line bound', { instanceId });

  return { phoneNumber: phone };
};

export const clearDecisionSmsLine = async ({
  instanceId,
}: {
  instanceId: string;
}): Promise<{ cleared: boolean }> => {
  const removed = await db
    .delete(decisionSmsLines)
    .where(eq(decisionSmsLines.processInstanceId, instanceId))
    .returning({ id: decisionSmsLines.id });

  if (removed.length > 0) {
    logger.info('Decision SMS line cleared', { instanceId });
  }

  return { cleared: removed.length > 0 };
};
