import { and, asc, db, desc, eq, inArray, isNull, notInArray } from '@op/db/client';
import {
  ProposalStatus,
  Visibility,
  processInstances,
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
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { getProposalRelationshipData } from './getProposalRelationshipData';
import { parseProposalData } from './proposalDataSchema';
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

const buildBaseWhereConditions = (input: ListAllProposalsInput) => {
  const { processInstanceId, status } = input;

  const conditions = [eq(proposals.processInstanceId, processInstanceId)];

  if (status) {
    conditions.push(eq(proposals.status, status));
  }

  return and(...conditions);
};

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
  const { processInstanceId } = input;

  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  const currentProfileId = await getCurrentProfileId(input.authUserId);

  const instance = await db._query.processInstances.findFirst({
    where: eq(processInstances.id, processInstanceId),
  });

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

  let whereClause = buildBaseWhereConditions(input);

  const { categoryId } = input;
  if (categoryId) {
    const proposalIdsInCategory = await db
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(eq(proposalCategories.taxonomyTermId, categoryId));

    if (proposalIdsInCategory.length === 0) {
      return { proposals: [], total: 0, hasMore: false };
    }

    whereClause = and(
      whereClause,
      inArray(
        proposals.id,
        proposalIdsInCategory.map((p) => p.proposalId),
      ),
    );
  }

  const validFilter = and(
    notInArray(proposals.status, [
      ProposalStatus.DRAFT,
      ProposalStatus.REJECTED,
      ProposalStatus.DUPLICATE,
    ]),
    isNull(proposals.deletedAt),
    eq(proposals.visibility, Visibility.VISIBLE),
  );

  whereClause = and(whereClause, validFilter);

  const orderColumn = proposals[orderBy] ?? proposals.createdAt;
  const orderFn = dir === 'asc' ? asc : desc;

  const [proposalList, countResult] = await Promise.all([
    db._query.proposals.findMany({
      where: whereClause,
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
      orderBy: orderFn(orderColumn),
    }),
    db.select({ count: countFn() }).from(proposals).where(whereClause),
  ]);

  const count = countResult[0]?.count || 0;

  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData as Record<string, unknown> | null,
    instance.processId,
  );

  type ProposalListItem = (typeof proposalList)[number];

  const profileIds = proposalList
    .map((proposal) => proposal.profileId)
    .filter((id): id is string => Boolean(id));

  const [relationshipData, documentContentMap] = await Promise.all([
    getProposalRelationshipData({ profileIds, currentProfileId }),
    getProposalDocumentsContent(
      proposalList.map((proposal) => {
        const parsed = parseProposalData(proposal.proposalData);
        return {
          id: proposal.id,
          proposalData: proposal.proposalData,
          proposalTemplate,
          collaborationDocVersionId:
            proposal.status === ProposalStatus.DRAFT
              ? undefined
              : parsed.collaborationDocVersionId,
        };
      }),
    ),
  ]);

  const proposalsWithCounts = proposalList.map((proposal: ProposalListItem) => {
    const submittedBy = Array.isArray(proposal.submittedBy)
      ? proposal.submittedBy[0]
      : proposal.submittedBy;
    const profile = Array.isArray(proposal.profile)
      ? proposal.profile[0]
      : proposal.profile;
    const relationshipInfo = proposal.profileId
      ? relationshipData.get(proposal.profileId)
      : null;

    return {
      id: proposal.id,
      processInstanceId: proposal.processInstanceId,
      proposalData: parseProposalData(proposal.proposalData),
      status: proposal.status,
      visibility: proposal.visibility,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
      profileId: proposal.profileId,
      submittedBy: submittedBy,
      profile: profile,
      likesCount: relationshipInfo?.likesCount || 0,
      followersCount: relationshipInfo?.followersCount || 0,
      isLikedByUser: relationshipInfo?.isLikedByUser || false,
      isFollowedByUser: relationshipInfo?.isFollowedByUser || false,
      commentsCount: relationshipInfo?.commentsCount || 0,
      documentContent: documentContentMap.get(proposal.id),
      proposalTemplate,
    };
  });

  return {
    proposals: proposalsWithCounts,
    total: Number(count),
    hasMore: offset + limit < Number(count),
  };
};
