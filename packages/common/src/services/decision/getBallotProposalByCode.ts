import { and, db, eq } from '@op/db/client';
import { profiles, proposals } from '@op/db/schema';

import {
  type BallotInstance,
  priceBallotProposals,
} from './ballotProposalCosts';
import { ballotProposalFilter } from './ballotProposalFilter';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { parseProposalData } from './proposalDataSchema';
import { buildProposalListPreview } from './proposalListPreview';
import { resolveProposalTemplate } from './resolveProposalTemplate';

export interface BallotProposalInfo {
  id: string;
  code: number;
  title: string;
  cost: string | null;
  summary: string | null;
}

export async function getBallotProposalByCode({
  instance,
  taxonomyTermId,
  code,
}: {
  instance: BallotInstance;
  taxonomyTermId?: string | null;
  code: number;
}): Promise<BallotProposalInfo | null> {
  const filter = await ballotProposalFilter({ instance, taxonomyTermId });

  if (filter.isEmpty) {
    return null;
  }

  const [row] = await db
    .select({
      id: proposals.id,
      title: profiles.name,
      proposalData: proposals.proposalData,
    })
    .from(proposals)
    .innerJoin(profiles, eq(profiles.id, proposals.profileId))
    .where(and(filter.where(proposals), eq(proposals.shortCode, code)))
    .limit(1);

  if (!row) {
    return null;
  }

  const parsed = parseProposalData(row.proposalData);
  const [costs, proposalTemplate] = await Promise.all([
    priceBallotProposals({ instance, proposals: [row] }),
    resolveProposalTemplate(instance.instanceData, instance.processId),
  ]);
  const documentContent = (
    await getProposalDocumentsContent(
      [
        {
          id: row.id,
          proposalData: row.proposalData,
          proposalTemplate,
          collaborationDocVersionId: parsed.collaborationDocVersionId,
        },
      ],
      { onFetchError: 'omit' },
    )
  ).get(row.id);
  const { previewText } = buildProposalListPreview({
    documentContent,
    proposalTemplate,
    existingBudget: parsed.budget,
  });
  const summary = (previewText ?? parsed.description ?? '').trim();

  return {
    id: row.id,
    code,
    title: row.title,
    cost: costs.get(row.id) ?? null,
    summary: summary ? summary : null,
  };
}
