import { getTextPreview } from '@op/core';
import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';
import { permission } from 'access-zones';

import { assertInstanceProfileAccess } from '../access';
import { getProposalDocumentsContent } from '../decision/getProposalDocumentsContent';
import { parseProposalData } from '../decision/proposalDataSchema';
import { buildProposalListPreview } from '../decision/proposalListPreview';
import { resolveProposalTemplate } from '../decision/resolveProposalTemplate';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';
import type { ProposalTranslation } from './translateProposal';
import {
  flattenTranslatableFields,
  unflattenTranslatedFields,
} from './translatedFields';

/**
 * Translates proposal card-level content (title, category, preview text) for
 * a batch of proposals in a single DeepL call.
 */
export async function translateProposals({
  profileIds,
  targetLocale,
  user,
}: {
  profileIds: string[];
  targetLocale: SupportedLocale;
  user: User | undefined;
}): Promise<{
  translations: Record<string, ProposalTranslation>;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  // 1. Bulk-fetch only the columns we need + processInstance relation
  const proposals = await db.query.proposals.findMany({
    where: { profileId: { in: profileIds } },
    columns: {
      id: true,
      profileId: true,
      proposalData: true,
    },
    with: {
      profile: {
        columns: {
          name: true,
        },
      },
      processInstance: {
        columns: {
          profileId: true,
          ownerProfileId: true,
          instanceData: true,
          processId: true,
        },
      },
    },
  });

  if (proposals.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  // 2. Deduplicate process instances and assert read access + resolve templates
  const uniqueProcesses = new Map<
    string,
    {
      profileId: string | null;
      ownerProfileId: string | null;
      instanceData: unknown;
      processId: string;
    }
  >();
  for (const p of proposals) {
    if (!uniqueProcesses.has(p.processInstance.processId)) {
      uniqueProcesses.set(p.processInstance.processId, {
        profileId: p.processInstance.profileId,
        ownerProfileId: p.processInstance.ownerProfileId,
        instanceData: p.processInstance.instanceData,
        processId: p.processInstance.processId,
      });
    }
  }

  const templateByProcessId = new Map<
    string,
    Awaited<ReturnType<typeof resolveProposalTemplate>>
  >();
  await Promise.all(
    [...uniqueProcesses.values()].map(async (instance) => {
      // Assert the user has decisions:READ on each unique process instance
      await assertInstanceProfileAccess({
        user: user ? { id: user.id } : undefined,
        instance,
        profilePermissions: [
          { decisions: permission.READ },
          { decisions: permission.ADMIN },
        ],
        orgFallbackPermissions: [
          { decisions: permission.READ },
          { decisions: permission.ADMIN },
        ],
      });

      const template = await resolveProposalTemplate(
        instance.instanceData as Record<string, unknown> | null,
        instance.processId,
      );
      templateByProcessId.set(instance.processId, template);
    }),
  );

  // 3. Batch document fetch
  const documentContentMap = await getProposalDocumentsContent(
    proposals.map((p) => ({
      id: p.id,
      proposalData: p.proposalData,
      proposalTemplate:
        templateByProcessId.get(p.processInstance.processId) ?? null,
    })),
    // A single unavailable document must not break the whole batch.
    { onFetchError: 'omit' },
  );

  // 4. Build translatable entries for all proposals
  const entries: TranslatableEntry[] = [];

  for (const proposal of proposals) {
    const proposalData = parseProposalData(proposal.proposalData);
    const pid = proposal.profileId;

    if (!pid) {
      continue;
    }

    // The same body preview the card shows. System fields (title, budget,
    // category) are document fragments too, and the title comes first, so
    // taking the first fragment would translate the title twice.
    const { previewText } = buildProposalListPreview({
      documentContent: documentContentMap.get(proposal.id),
      proposalTemplate:
        templateByProcessId.get(proposal.processInstance.processId) ?? null,
    });
    const preview = previewText
      ? getTextPreview({ content: previewText, maxLines: 3, maxLength: 200 }) ||
        undefined
      : undefined;

    entries.push(
      ...flattenTranslatableFields(`batch:${pid}:`, {
        title: proposal.profile?.name,
        category: proposalData.category,
        preview,
      }),
    );
  }

  if (entries.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  // 5. Translate via DeepL with cache-through
  const results = await runTranslateBatch(entries, targetLocale);

  // 6. Build response grouped by profileId
  const translations: Record<string, ProposalTranslation> = {};
  const resultsByProfileId = new Map<string, typeof results>();
  let sourceLocale = '';

  for (const result of results) {
    const parts = result.contentKey.split(':');
    if (parts.length < 3 || parts[0] !== 'batch') {
      continue;
    }

    const profileId = parts[1];

    if (!profileId) {
      continue;
    }

    const profileResults = resultsByProfileId.get(profileId) ?? [];
    profileResults.push(result);
    resultsByProfileId.set(profileId, profileResults);

    if (!sourceLocale && result.sourceLocale) {
      sourceLocale = result.sourceLocale;
    }
  }

  for (const [profileId, profileResults] of resultsByProfileId) {
    translations[profileId] = unflattenTranslatedFields(
      `batch:${profileId}:`,
      profileResults,
    ).translated as ProposalTranslation;
  }

  return { translations, sourceLocale, targetLocale };
}
