import {
  type SQL,
  and,
  db,
  eq,
  exists,
  ilike,
  isNull,
  or,
} from '@op/db/client';
import {
  ProposalRelationshipType,
  ProposalStatus,
  profiles,
  proposalRelationships,
  proposals,
} from '@op/db/schema';
import { alias } from 'drizzle-orm/pg-core';

import {
  type PhaseScopedInstance,
  getPhaseProposalSqlScope,
} from './getProposalsForPhase';
import {
  activeProposalPredicate,
  phaseEligiblePredicate,
} from './phaseEligibility';
import { notSuperseded } from './proposalSupersession';
import { buildProposalTitleSearchCondition } from './proposalTitleSearch';
import { isProposalProfileMember } from './proposalVisibility';
import { escapeLikePattern, splitSearchWords } from './utils/search';

export interface OwnDevelopedEntryScope {
  /** The current phase is unreached: no entry can match. */
  isEmpty: boolean;
  /**
   * Matches the caller's own entries of the current phase: live proposals the
   * caller is a member of, each the target of a live `developed` edge. Takes
   * the table so it works on the relational alias and the schema table alike.
   */
  buildFilter: (proposalsTable: typeof proposals) => SQL;
}

/**
 * The caller's own developed entries of the instance's current phase, as a SQL
 * predicate. Shared by the entries list and the origins list's lookup of the
 * caller's entry per origin, so both agree on what an entry of the caller is.
 */
export async function getOwnDevelopedEntryScope({
  instance,
  processInstanceId,
  authUserId,
}: {
  instance: PhaseScopedInstance;
  processInstanceId: string;
  authUserId: string;
}): Promise<OwnDevelopedEntryScope> {
  const phaseScope = await getPhaseProposalSqlScope({
    instance,
    authUserIds: [authUserId],
  });

  return {
    isEmpty: phaseScope.isEmpty,
    buildFilter: (table) =>
      and(
        eq(table.processInstanceId, processInstanceId),
        activeProposalPredicate(table),
        notSuperseded({ proposalId: table.id, processInstanceId }),
        isProposalProfileMember(table, authUserId),
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
  };
}

const originProposals = alias(proposals, 'origin_proposals');

/**
 * Entry search: every word in the entry's title, or every word in the title of
 * one of its origins. Titles are profile names, kept current by autosave.
 */
export function buildEntrySearchCondition(
  table: typeof proposals,
  search: string | undefined,
): SQL | undefined {
  const words = splitSearchWords(search);
  const titleMatch = buildProposalTitleSearchCondition(table, search);
  if (!titleMatch || words.length === 0) {
    return undefined;
  }

  const originMatch = exists(
    db
      .select({ id: proposalRelationships.id })
      .from(proposalRelationships)
      .innerJoin(
        originProposals,
        eq(originProposals.id, proposalRelationships.sourceProposalId),
      )
      .innerJoin(profiles, eq(profiles.id, originProposals.profileId))
      .where(
        and(
          eq(proposalRelationships.targetProposalId, table.id),
          eq(
            proposalRelationships.relationshipType,
            ProposalRelationshipType.DEVELOPED,
          ),
          isNull(proposalRelationships.deletedAt),
          ...words.map((word) =>
            ilike(profiles.name, `%${escapeLikePattern(word)}%`),
          ),
        ),
      ),
  );

  return or(titleMatch, originMatch);
}
