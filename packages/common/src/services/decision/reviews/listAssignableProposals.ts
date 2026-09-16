import { and, db, ne } from '@op/db/client';
import { ProposalStatus } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import {
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../../utils';
import { assertProfileAccess } from '../../assert';
import { getInstance } from '../getInstance';
import { getProposalDocumentsContent } from '../getProposalDocumentsContent';
import { isAnonymousAuthor, proposalAuthorRelation } from '../proposalAuthor';
import { parseProposalData } from '../proposalDataSchema';
import { buildProposalListPreview } from '../proposalListPreview';
import { resolveProposalListScope } from '../resolveProposalListScope';
import { resolveProposalTemplate } from '../resolveProposalTemplate';
import type { InstancePhaseRef } from '../schemas/instance';
import {
  type AssignableProposalList,
  assignableProposalListSchema,
} from '../schemas/reviewAssignments';
import { assertInstancePhase } from '../utils/instance';

export interface ListAssignableProposalsInput extends InstancePhaseRef {
  user: User;
  /** Whose assignment state each row is annotated with. */
  reviewerProfileId: string;
  /** Free-text title search, as every other proposal list spells it. */
  search?: string;
  /** Opaque position from the previous page's `next`. */
  cursor?: string | null;
  limit: number;
}

/**
 * One page of the proposals an admin could assign to a reviewer in a phase,
 * each row carrying that reviewer's assignment state for the phase.
 *
 * The state is a `LEFT JOIN` in this page's own query, so a row is correct
 * however much of the reviewer's queue the caller has loaded — the reason this
 * read exists rather than the dialog cross-referencing two lists.
 *
 * Scope, visibility and search come from `resolveProposalListScope`, the same
 * resolver `listProposals` uses, so the pick list can't offer a proposal the
 * proposal list would hide. Drafts are dropped here rather than filtered by
 * the caller: `assignReviewsToReviewer` rejects the whole request when any id
 * is outside the phase pool, and a draft never is.
 */
export async function listAssignableProposals({
  user,
  processInstanceId,
  phaseId,
  reviewerProfileId,
  search,
  cursor,
  limit,
}: ListAssignableProposalsInput): Promise<AssignableProposalList> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  // No org fallback: legacy instances without their own profile fail closed.
  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }
  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  assertInstancePhase({ instance, phaseId });

  const scope = await resolveProposalListScope({
    input: { processInstanceId, phaseId, search },
    user,
  });

  if (scope.isEmpty) {
    return assignableProposalListSchema.parse({ items: [], next: null });
  }

  const decodedCursor = cursor
    ? decodeCursor<{ value: string; id: string }>(cursor)
    : undefined;

  const [rows, proposalTemplate] = await Promise.all([
    db.query.proposals.findMany({
      where: {
        RAW: (table) =>
          and(
            scope.buildWhereClause(table),
            ne(table.status, ProposalStatus.DRAFT),
            getCursorCondition({
              column: table.createdAt,
              tieBreakerColumn: table.id,
              cursor: decodedCursor,
              direction: 'desc',
            }),
          )!,
      },
      columns: {
        id: true,
        profileId: true,
        proposalData: true,
        status: true,
        submittedByProfileId: true,
        createdAt: true,
      },
      with: {
        profile: { columns: { name: true } },
        submittedBy: proposalAuthorRelation,
        // The whole point of this read: the reviewer's own row for the phase,
        // decided by the join rather than by anything the client holds.
        reviewAssignments: {
          where: { processInstanceId, phaseId, reviewerProfileId },
          columns: { id: true, status: true },
        },
      },
      // `id` tie-break: rows sharing a `createdAt` would otherwise page in an
      // undefined order, which skips and repeats rows across pages.
      orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
      // One extra row to detect whether a next page exists.
      limit: limit + 1,
    }),
    resolveProposalTemplate(
      instance.instanceData as Record<string, unknown> | null,
      instance.processId,
    ),
  ]);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  // Same resolution the proposal list performs, so a title or a category chip
  // here reads identically to the same proposal elsewhere in the app.
  const documentContentMap = await getProposalDocumentsContent(
    pageRows.map((row) => {
      const parsed = parseProposalData(row.proposalData);
      return {
        id: row.id,
        proposalData: row.proposalData,
        proposalTemplate,
        collaborationDocVersionId: parsed.collaborationDocVersionId,
      };
    }),
    // A single unavailable document must not break the whole list.
    { onFetchError: 'omit' },
  );

  const items = pageRows.map((row) => {
    const parsedProposalData = parseProposalData(row.proposalData);
    const { systemFieldOverrides } = buildProposalListPreview({
      documentContent: documentContentMap.get(row.id),
      proposalTemplate,
      existingBudget: parsedProposalData.budget,
    });
    const author = row.submittedBy ?? null;

    return {
      id: row.id,
      profileId: row.profileId,
      proposalData: { ...parsedProposalData, ...systemFieldOverrides },
      profileName: row.profile?.name ?? null,
      author: author
        ? {
            name: author.name,
            slug: author.slug,
            isAnonymous: isAnonymousAuthor(author.profileUsers),
          }
        : null,
      assignment: row.reviewAssignments[0] ?? null,
      // Matches the insert's own self-filter (`insertReviewAssignments`), so a
      // row this flags is exactly a row the write would refuse to create.
      isOwn: row.submittedByProfileId === reviewerProfileId,
    };
  });

  const lastRow = pageRows[pageRows.length - 1];

  return assignableProposalListSchema.parse({
    items,
    next:
      hasMore && lastRow?.createdAt != null
        ? encodeCursor<{ value: string; id: string }>({
            value: lastRow.createdAt,
            id: lastRow.id,
          })
        : null,
  });
}
