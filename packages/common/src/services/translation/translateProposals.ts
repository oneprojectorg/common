import { type SQL, and, db, eq, inArray, or } from '@op/db/client';
import { proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';
import { permission } from 'access-zones';

import { assertInstanceProfileAccess } from '../access';
import { getProposalDocumentsContent } from '../decision/getProposalDocumentsContent';
import { parseProposalData } from '../decision/proposalDataSchema';
import { buildProposalListPreview } from '../decision/proposalListPreview';
import {
  getProposalReadContext,
  isProposalReadable,
} from '../decision/proposalVisibility';
import { resolveProposalTemplate } from '../decision/resolveProposalTemplate';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';
import type { ProposalTranslation } from './translateProposal';
import {
  flattenTranslatableFields,
  unflattenTranslatedFields,
} from './translatedFields';

const MAX_PREVIEW_LENGTH = 200;

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
  const accessUser = user ? { id: user.id } : undefined;

  // 1. Resolve the process instances behind the requested profiles. Nothing
  // from this query reaches the caller: it only drives the access checks.
  const requested = await db.query.proposals.findMany({
    where: { profileId: { in: profileIds } },
    columns: { id: true },
    with: {
      processInstance: {
        columns: {
          id: true,
          profileId: true,
          ownerProfileId: true,
          instanceData: true,
          processId: true,
        },
      },
    },
  });

  if (requested.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  // 2. Deduplicate process instances and assert read access + resolve templates
  const uniqueInstances = new Map<
    string,
    (typeof requested)[number]['processInstance']
  >();
  for (const p of requested) {
    if (!uniqueInstances.has(p.processInstance.id)) {
      uniqueInstances.set(p.processInstance.id, p.processInstance);
    }
  }

  const templateByInstanceId = new Map<
    string,
    Awaited<ReturnType<typeof resolveProposalTemplate>>
  >();
  // Per-instance `getProposal` gate (draft / hidden / flagged / deleted), built
  // from the roles the instance assert returns so an instance admin widens to
  // the same rows the single-proposal path would show them.
  const readableByInstance: ((proposalsTable: typeof proposals) => SQL)[] = [];
  await Promise.all(
    [...uniqueInstances.values()].map(async (instance) => {
      // Assert the user has decisions:READ on each unique process instance
      const decisionRoles = await assertInstanceProfileAccess({
        user: accessUser,
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
      const readContext = getProposalReadContext({
        user: accessUser,
        decisionRoles,
      });
      readableByInstance.push((proposalsTable) =>
        and(
          eq(proposalsTable.processInstanceId, instance.id),
          isProposalReadable(proposalsTable, readContext),
        )!,
      );

      const template = await resolveProposalTemplate(
        instance.instanceData as Record<string, unknown> | null,
        instance.processId,
      );
      templateByInstanceId.set(instance.id, template);
    }),
  );

  // Instance read access alone is not proposal read access: the same rows
  // `getProposal` would 404 on (another member's draft, a hidden or flagged
  // proposal) are silently dropped here rather than translated.
  const readableProposals = await db.query.proposals.findMany({
    where: {
      RAW: (table) =>
        and(
          inArray(table.profileId, profileIds),
          or(...readableByInstance.map((readable) => readable(table))),
        )!,
    },
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
          id: true,
        },
      },
    },
  });

  if (readableProposals.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  // 3. Batch document fetch
  const documentContentMap = await getProposalDocumentsContent(
    readableProposals.map((p) => ({
      id: p.id,
      proposalData: p.proposalData,
      proposalTemplate: templateByInstanceId.get(p.processInstance.id) ?? null,
    })),
    // A single unavailable document must not break the whole batch.
    { onFetchError: 'omit' },
  );

  // 4. Build translatable entries for all proposals
  const entries: TranslatableEntry[] = [];

  for (const proposal of readableProposals) {
    const proposalData = parseProposalData(proposal.proposalData);
    const pid = proposal.profileId;

    if (!pid) {
      continue;
    }

    // The body text the card shows, not the first fragment (the title).
    const { previewText } = buildProposalListPreview({
      documentContent: documentContentMap.get(proposal.id),
      proposalTemplate:
        templateByInstanceId.get(proposal.processInstance.id) ?? null,
    });
    // Already plain text: cap it without re-parsing it as HTML.
    const preview =
      previewText?.slice(0, MAX_PREVIEW_LENGTH).trim() || undefined;

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
