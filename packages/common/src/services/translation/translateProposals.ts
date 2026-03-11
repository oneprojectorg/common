import { getTextPreview } from '@op/core';
import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';
import { permission } from 'access-zones';

import { assertInstanceProfileAccess } from '../access';
import { generateProposalHtml } from '../decision/generateProposalHtml';
import { getProposalDocumentsContent } from '../decision/getProposalDocumentsContent';
import { resolveProposalTemplate } from '../decision/resolveProposalTemplate';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

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
  user: User;
}): Promise<{
  translations: Record<
    string,
    { title?: string; category?: string; preview?: string }
  >;
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
        user: { id: user.id },
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
  );

  // 4. Build translatable entries for all proposals
  const entries: TranslatableEntry[] = [];

  for (const proposal of proposals) {
    const proposalData = proposal.proposalData as Record<string, unknown>;
    const pid = proposal.profileId;

    if (!pid) {
      continue;
    }

    if (proposal.profile?.name) {
      entries.push({
        contentKey: `batch:${pid}:title`,
        text: proposal.profile.name,
      });
    }

    if (proposalData.category && typeof proposalData.category === 'string') {
      entries.push({
        contentKey: `batch:${pid}:category`,
        text: proposalData.category,
      });
    }

    // Generate HTML from document content and extract plain-text preview
    const documentContent = documentContentMap.get(proposal.id);
    let htmlContent: Record<string, string> | undefined;

    if (documentContent?.type === 'json') {
      htmlContent = generateProposalHtml(documentContent.fragments);
    } else if (documentContent?.type === 'html') {
      htmlContent = { default: documentContent.content };
    }

    if (htmlContent) {
      const firstHtml = Object.values(htmlContent).find(Boolean);
      if (firstHtml) {
        const plainText = getTextPreview({
          content: firstHtml,
          maxLines: 3,
          maxLength: 200,
        });
        if (plainText) {
          entries.push({
            contentKey: `batch:${pid}:preview`,
            text: plainText,
          });
        }
      }
    }
  }

  if (entries.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  // 5. Translate via DeepL with cache-through
  const results = await runTranslateBatch(entries, targetLocale);

  // 6. Build response grouped by profileId
  const translations: Record<
    string,
    { title?: string; category?: string; preview?: string }
  > = {};
  let sourceLocale = '';

  for (const result of results) {
    // Key format: batch:<profileId>:<field>
    const parts = result.contentKey.split(':');
    if (parts.length < 3 || parts[0] !== 'batch') {
      continue;
    }
    const field = parts[parts.length - 1] as 'title' | 'category' | 'preview';
    const profileId = parts.slice(1, -1).join(':');

    if (!translations[profileId]) {
      translations[profileId] = {};
    }
    translations[profileId][field] = result.translatedText;

    if (!sourceLocale && result.sourceLocale) {
      sourceLocale = result.sourceLocale;
    }
  }

  return { translations, sourceLocale, targetLocale };
}
