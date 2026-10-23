import { db, eq, sql } from '@op/db/client';
import { decisionChatLines } from '@op/db/schema';
import { logger } from '@op/logging';

import { ConflictError, NotFoundError } from '../../utils';
import {
  normalizePhoneNumber,
  parsePhoneNumber,
} from '../notification/schemas';
import { lockProcessInstance } from './lockProcessInstance';

export interface DecisionChatLine {
  phoneNumber: string;
}

export const getDecisionChatLine = async ({
  instanceId,
}: {
  instanceId: string;
}): Promise<DecisionChatLine | null> => {
  const line = await db.query.decisionChatLines.findFirst({
    where: { processInstanceId: instanceId },
    columns: { phoneNumber: true },
  });

  return line ?? null;
};

export const setDecisionChatLine = async ({
  instanceId,
  phoneNumber,
}: {
  instanceId: string;
  phoneNumber: string;
}): Promise<DecisionChatLine> => {
  const phone = parsePhoneNumber(normalizePhoneNumber(phoneNumber));

  await db.transaction(async (tx) => {
    const locked = await lockProcessInstance({ db: tx, instanceId });
    if (!locked) {
      throw new NotFoundError('Decision instance', instanceId);
    }

    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${'decision_chat_lines:' + phone}))`,
    );

    const holder = await tx.query.decisionChatLines.findFirst({
      where: { phoneNumber: phone },
      columns: { processInstanceId: true },
    });
    if (holder && holder.processInstanceId !== instanceId) {
      throw new ConflictError('This number is bound to another decision');
    }

    await tx
      .insert(decisionChatLines)
      .values({ processInstanceId: instanceId, phoneNumber: phone })
      .onConflictDoUpdate({
        target: decisionChatLines.processInstanceId,
        set: { phoneNumber: phone },
      });
  });

  logger.info('Chat line bound', { instanceId });

  return { phoneNumber: phone };
};

export const clearDecisionChatLine = async ({
  instanceId,
}: {
  instanceId: string;
}): Promise<{ cleared: boolean }> => {
  const removed = await db
    .delete(decisionChatLines)
    .where(eq(decisionChatLines.processInstanceId, instanceId))
    .returning({ id: decisionChatLines.id });

  if (removed.length > 0) {
    logger.info('Chat line cleared', { instanceId });
  }

  return { cleared: removed.length > 0 };
};
