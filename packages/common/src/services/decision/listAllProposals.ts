import { and, db, eq, inArray, isNull, notInArray } from '@op/db/client';
import {
  ProposalStatus,
  Visibility,
  proposalCategories,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { count as countFn } from 'drizzle-orm';

import { UnauthorizedError } from '../../utils';
import {
  assertInstanceProfileAccess,
  getCurrentProfileId,
} from '../access';
import { buildProposalListItem } from './buildProposalListItem';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { getProposalRelationshipData } from './getProposalRelationshipData';
import { resolveProposalTemplate } from './resolveProposalTemplate';

export interface ListAllProposalsInput {
  processInstanceId: string;
  status?: ProposalStatus;
  categoryId?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'status';
  dir?: 'asc' | 'desc';
  authUserId: string;
}

/**
 * Returns every valid (non-draft, non-rejected, non-duplicate, non-deleted,
 * non-hidden) proposal on the instance. All process members see the same set
 * — no admin-only branching. Used by the "All proposals" tab on the results
 * page so members can browse the full submission set after a limiting
 * pipeline has narrowed the phase.
 */
export const listAllProposals = async ({
  input,
  user,
}: {
  input: ListAllProposalsInput;
  user: User;
}) => {
  const { processInstanceId, status } = input;

  const [currentProfileId, instance] = await Promise.all([
    getCurrentProfileId(input.authUserId),
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
    }),
  ]);

  if (!instance?.profileId) {
    throw new UnauthorizedError('User does not have access to this process');
  }

  await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
    orgFallbackPermissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
  });

  const { limit = 20, offset = 0, orderBy = 'createdAt', dir = 'desc' } = input;

  let categoryProposalIds: string[] | undefined;
  if (input.categoryId) {
    const rows = await db
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(eq(proposalCategories.taxonomyTermId, input.categoryId));

    if (rows.length === 0) {
      return { proposals: [], total: 0, hasMore: false };
    }

    categoryProposalIds = rows.map((r) => r.proposalId);
  }

  const buildWhere = (table: typeof proposals) =>
    and(
      eq(table.processInstanceId, processInstanceId),
      status ? eq(table.status, status) : undefined,
      categoryProposalIds ? inArray(table.id, categoryProposalIds) : undefined,
      notInArray(table.status, [
        ProposalStatus.DRAFT,
        ProposalStatus.REJECTED,
        ProposalStatus.DUPLICATE,
      ]),
      isNull(table.deletedAt),
      eq(table.visibility, Visibility.VISIBLE),
    );

  const [proposalList, countResult] = await Promise.all([
    db.query.proposals.findMany({
      where: { RAW: (table) => buildWhere(table)! },
      with: {
        submittedBy: {
          with: {
            avatarImage: true,
          },
        },
        profile: true,
      },
      limit,
      offset,
      orderBy: (table, { asc, desc }) => {
        const col = table[orderBy] ?? table.createdAt;
        return dir === 'asc' ? asc(col) : desc(col);
      },
    }),
    db
      .select({ count: countFn() })
      .from(proposals)
      .where(buildWhere(proposals)),
  ]);

  const count = countResult[0]?.count || 0;

  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData as Record<string, unknown> | null,
    instance.processId,
  );

  const profileIds = proposalList
    .map((proposal) => proposal.profileId)
    .filter((id): id is string => Boolean(id));

  const [relationshipData, documentContentMap] = await Promise.all([
    getProposalRelationshipData({ profileIds, currentProfileId }),
    getProposalDocumentsContent(
      proposalList.map((proposal) => ({
        id: proposal.id,
        proposalData: proposal.proposalData,
        proposalTemplate,
      })),
    ),
  ]);

  const proposalsWithCounts = proposalList.map((proposal) =>
    buildProposalListItem({
      proposal,
      relationshipData,
      documentContentMap,
      proposalTemplate,
    }),
  );

  return {
    proposals: proposalsWithCounts,
    total: Number(count),
    hasMore: offset + limit < Number(count),
  };
};
