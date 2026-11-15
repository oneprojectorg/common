import { and, db, eq, exists, isNull, or } from '@op/db/client';
import {
  ProposalRelationshipType,
  ProposalStatus,
  proposalRelationships,
} from '@op/db/schema';
import { permission } from 'access-zones';

import { NotFoundError, PAGE_LIMIT } from '../../utils';
import type { AccessUser } from '../access';
import { assertProfileAccess } from '../assert';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { getPhaseProposalSqlScope } from './getProposalsForPhase';
import {
  activeProposalPredicate,
  phaseEligiblePredicate,
} from './phaseEligibility';
import { parseProposalData } from './proposalDataSchema';
import { buildProposalListPreview } from './proposalListPreview';
import { notSuperseded } from './proposalSupersession';
import { isProposalProfileMember } from './proposalVisibility';
import { resolveProposalTemplatesByFormSchemaId } from './resolveProposalTemplate';
import type {
  ListOwnDevelopedProposalsInput,
  OwnDevelopedProposalList,
} from './schemas/ownDevelopedProposals';

/**
 * The caller's own developed proposals in the instance's current phase:
 * drafts and submitted ones, each the target of a live `developed` edge, with
 * the proposals it was developed from. "Own" is a membership on the proposal's
 * profile (author or co-author), the set that may read a draft.
 *
 * Unpaginated: one author's entries in one phase, a handful in practice.
 * `PAGE_LIMIT.max` caps it in SQL.
 */
export async function listOwnDevelopedProposals({
  processInstanceId,
  user,
}: ListOwnDevelopedProposalsInput & {
  user: AccessUser;
}): Promise<OwnDevelopedProposalList> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: {
      id: true,
      profileId: true,
      processId: true,
      instanceData: true,
      currentStateId: true,
    },
  });

  if (!instance?.profileId) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.READ },
  });

  const phaseScope = await getPhaseProposalSqlScope({
    instance,
    authUserIds: [user.id],
  });

  if (phaseScope.isEmpty) {
    return { items: [] };
  }

  const rows = await db.query.proposals.findMany({
    where: {
      processInstanceId,
      RAW: (table) =>
        and(
          activeProposalPredicate(table),
          notSuperseded({ proposalId: table.id, processInstanceId }),
          isProposalProfileMember(table, user.id),
          exists(
            db
              .select({ id: proposalRelationships.id })
              .from(proposalRelationships)
              .where(
                and(
                  eq(proposalRelationships.targetProposalId, table.id),
                  eq(
                    proposalRelationships.relationshipType,
                    ProposalRelationshipType.DEVELOPED,
                  ),
                  isNull(proposalRelationships.deletedAt),
                ),
              ),
          ),
          // Drafts never join a phase, so they match by their creation
          // window; the rest by phase membership, which drops rejected ones.
          or(
            and(
              eq(table.status, ProposalStatus.DRAFT),
              phaseScope.buildDraftFilter(table),
            ),
            and(
              phaseEligiblePredicate(table),
              phaseScope.buildNonDraftFilter(table),
            ),
          ),
        )!,
    },
    columns: {
      id: true,
      profileId: true,
      status: true,
      visibility: true,
      createdAt: true,
      proposalData: true,
      formSchemaId: true,
    },
    with: { profile: { columns: { name: true } } },
    orderBy: { createdAt: 'desc', id: 'desc' },
    limit: PAGE_LIMIT.max,
  });

  if (rows.length === 0) {
    return { items: [] };
  }

  const [edges, templateFor] = await Promise.all([
    db.query.proposalRelationships.findMany({
      where: {
        targetProposalId: { in: rows.map((row) => row.id) },
        relationshipType: ProposalRelationshipType.DEVELOPED,
        deletedAt: { isNull: true },
      },
      columns: { targetProposalId: true },
      with: {
        sourceProposal: {
          columns: { id: true },
          with: { profile: { columns: { name: true } } },
        },
      },
      orderBy: { createdAt: 'asc', id: 'asc' },
    }),
    resolveProposalTemplatesByFormSchemaId({
      formSchemaIds: rows.map((row) => row.formSchemaId),
      instanceData: instance.instanceData,
      processId: instance.processId,
    }),
  ]);

  // Title and budget live in the document while an entry is edited, so they
  // are resolved from it as the proposal list does.
  const documentContent = await getProposalDocumentsContent(
    rows.map((row) => ({
      id: row.id,
      proposalData: row.proposalData,
      proposalTemplate: templateFor(row.formSchemaId),
      collaborationDocVersionId:
        row.status === ProposalStatus.DRAFT
          ? undefined
          : parseProposalData(row.proposalData).collaborationDocVersionId,
    })),
    { onFetchError: 'omit' },
  );

  return {
    items: rows.map((row) => {
      const proposalData = parseProposalData(row.proposalData);
      const { systemFieldOverrides } = buildProposalListPreview({
        documentContent: documentContent.get(row.id),
        proposalTemplate: templateFor(row.formSchemaId),
        existingBudget: proposalData.budget,
      });

      return {
        id: row.id,
        profileId: row.profileId,
        status: row.status,
        visibility: row.visibility,
        createdAt: row.createdAt,
        title: systemFieldOverrides.title ?? row.profile?.name ?? '',
        category: proposalData.category,
        budget: systemFieldOverrides.budget ?? proposalData.budget ?? null,
        origins: edges
          .filter((edge) => edge.targetProposalId === row.id)
          .map((edge) => ({
            id: edge.sourceProposal.id,
            name: edge.sourceProposal.profile?.name ?? '',
          })),
      };
    }),
  };
}
