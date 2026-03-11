import { and, db, eq } from '@op/db/client';
import {
  EntityType,
  processInstances,
  profileUsers,
  profiles,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';
import { type JSONContent, generateText } from '@tiptap/core';

import { NotFoundError, UnauthorizedError } from '../../utils';
import type { DecisionInstanceData } from '../decision/schemas/instanceData';
import { serverExtensions } from '../decision/tiptapExtensions';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

/** Extract plain text from a TipTap JSON string. Falls back to the raw string for plain text content. */
function extractTextFromTipTap(content: string): string {
  try {
    return generateText(
      JSON.parse(content) as JSONContent,
      serverExtensions,
    ).trim();
  } catch {
    return content;
  }
}

/**
 * Translates a decision's current-phase content (headline, description,
 * additionalInfo) and the process-level description into the target locale
 * via DeepL with cache-through semantics.
 */
export async function translateDecision({
  decisionProfileId,
  targetLocale,
  user,
}: {
  decisionProfileId: string;
  targetLocale: SupportedLocale;
  user: User;
}): Promise<{
  translated: Record<string, string>;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  // LEFT JOIN profileUsers so we can distinguish "not found" from "unauthorized"
  const rows = await db
    .select({
      profileId: profiles.id,
      description: processInstances.description,
      instanceData: processInstances.instanceData,
      authUserId: profileUsers.authUserId,
    })
    .from(profiles)
    .leftJoin(
      profileUsers,
      and(
        eq(profileUsers.profileId, profiles.id),
        eq(profileUsers.authUserId, user.id),
      ),
    )
    .innerJoin(processInstances, eq(processInstances.profileId, profiles.id))
    .where(
      and(
        eq(profiles.id, decisionProfileId),
        eq(profiles.type, EntityType.DECISION),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    throw new NotFoundError('Decision profile not found');
  }

  const row = rows[0]!;

  if (!row.authUserId) {
    throw new UnauthorizedError(
      'User does not have access to this decision profile',
    );
  }

  const instanceData = row.instanceData as DecisionInstanceData | null;
  const currentPhaseId = instanceData?.currentPhaseId;
  const currentPhase = currentPhaseId
    ? instanceData?.phases?.find((p) => p.phaseId === currentPhaseId)
    : undefined;

  const entries: TranslatableEntry[] = [];

  if (currentPhase?.headline) {
    entries.push({
      contentKey: `decision:${decisionProfileId}:headline`,
      text: currentPhase.headline,
    });
  }

  if (currentPhase?.description) {
    entries.push({
      contentKey: `decision:${decisionProfileId}:phaseDescription`,
      text: currentPhase.description,
    });
  }

  if (currentPhase?.additionalInfo) {
    entries.push({
      contentKey: `decision:${decisionProfileId}:additionalInfo`,
      text: extractTextFromTipTap(currentPhase.additionalInfo),
    });
  }

  for (const phase of instanceData?.phases ?? []) {
    if (phase.name) {
      entries.push({
        contentKey: `decision:${decisionProfileId}:phase:${phase.phaseId}:name`,
        text: phase.name,
      });
    }
  }

  if (row.description) {
    entries.push({
      contentKey: `decision:${decisionProfileId}:description`,
      text: row.description,
    });
  }

  if (entries.length === 0) {
    return { translated: {}, sourceLocale: '', targetLocale };
  }

  const results = await runTranslateBatch(entries, targetLocale);

  const prefix = `decision:${decisionProfileId}:`;
  const translated: Record<string, string> = {};
  let sourceLocale = '';

  for (const result of results) {
    const fieldName = result.contentKey.startsWith(prefix)
      ? result.contentKey.slice(prefix.length)
      : result.contentKey;
    translated[fieldName] = result.translatedText;

    if (!sourceLocale && result.sourceLocale) {
      sourceLocale = result.sourceLocale;
    }
  }

  return { translated, sourceLocale, targetLocale };
}
