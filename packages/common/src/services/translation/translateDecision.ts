import { and, db, eq } from '@op/db/client';
import { EntityType, processInstances, profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';
import type { JSONContent } from '@tiptap/core';
import { generateHTML } from '@tiptap/html';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import type { DecisionInstanceData } from '../decision/schemas/instanceData';
import { serverExtensions } from '../decision/tiptapExtensions';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

/**
 * Render a TipTap JSON string to HTML for translation.
 * Falls back to the raw string if content is not valid JSON (plain text).
 * Throws if JSON parses but HTML rendering fails, to avoid caching corrupt data.
 */
function renderTipTapToHtml(content: string): string {
  let parsed: JSONContent;
  try {
    parsed = JSON.parse(content) as JSONContent;
  } catch {
    return content;
  }
  return generateHTML(parsed, serverExtensions);
}

/**
 * Translates a decision's current-phase content (headline, description,
 * additionalInfo, phase names) and the process-level description into the
 * target locale via DeepL with cache-through semantics.
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
  headline?: string;
  phaseDescription?: string;
  additionalInfo?: string;
  description?: string;
  phases: Array<{ id: string; name: string }>;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  const instances = await db
    .select({
      description: processInstances.description,
      instanceData: processInstances.instanceData,
      profileId: processInstances.profileId,
      ownerProfileId: processInstances.ownerProfileId,
    })
    .from(processInstances)
    .innerJoin(profiles, eq(processInstances.profileId, profiles.id))
    .where(
      and(
        eq(profiles.id, decisionProfileId),
        eq(profiles.type, EntityType.DECISION),
      ),
    )
    .limit(1);

  if (instances.length === 0) {
    throw new NotFoundError('Decision profile not found');
  }

  const processInstance = instances[0]!;

  // Start the permission check immediately so it runs in parallel with translation
  const authPromise = assertInstanceProfileAccess({
    user,
    instance: {
      profileId: processInstance.profileId,
      ownerProfileId: processInstance.ownerProfileId,
    },
    profilePermissions: { decisions: permission.READ },
    orgFallbackPermissions: { decisions: permission.READ },
  });

  const instanceData =
    processInstance.instanceData as DecisionInstanceData | null;
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
      text: renderTipTapToHtml(currentPhase.additionalInfo),
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

  if (processInstance.description) {
    entries.push({
      contentKey: `decision:${decisionProfileId}:description`,
      text: processInstance.description,
    });
  }

  if (entries.length === 0) {
    await authPromise;
    return { phases: [], sourceLocale: '', targetLocale };
  }

  const [, results] = await Promise.all([
    authPromise,
    runTranslateBatch(entries, targetLocale),
  ]);

  const prefix = `decision:${decisionProfileId}:`;
  const phasePrefix = `${prefix}phase:`;
  let headline: string | undefined;
  let phaseDescription: string | undefined;
  let additionalInfo: string | undefined;
  let description: string | undefined;
  const phases: Array<{ id: string; name: string }> = [];
  let sourceLocale = '';

  for (const result of results) {
    const key = result.contentKey.startsWith(prefix)
      ? result.contentKey.slice(prefix.length)
      : result.contentKey;

    if (key === 'headline') {
      headline = result.translatedText;
    } else if (key === 'phaseDescription') {
      phaseDescription = result.translatedText;
    } else if (key === 'additionalInfo') {
      additionalInfo = result.translatedText;
    } else if (key === 'description') {
      description = result.translatedText;
    } else if (
      result.contentKey.startsWith(phasePrefix) &&
      result.contentKey.endsWith(':name')
    ) {
      const id = result.contentKey.slice(phasePrefix.length, -':name'.length);
      phases.push({ id, name: result.translatedText });
    }

    if (!sourceLocale && result.sourceLocale) {
      sourceLocale = result.sourceLocale;
    }
  }

  return {
    headline,
    phaseDescription,
    additionalInfo,
    description,
    phases,
    sourceLocale,
    targetLocale,
  };
}
