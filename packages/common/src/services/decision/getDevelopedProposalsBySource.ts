import { db } from '@op/db/client';
import { ProposalRelationshipType, ProposalStatus } from '@op/db/schema';
import pMap from 'p-map';

import { NotFoundError, ValidationError } from '../../utils';
import { assertProposalSubmittable } from './assertProposalSubmittable';
import {
  type ProposalReadContext,
  isProposalReadable,
} from './proposalVisibility';
import {
  type DevelopedProposal,
  developedProposalSchema,
} from './schemas/developSources';

/**
 * The entries developed from each source that the caller may read, keyed by
 * source id, oldest edge first. One query for the whole page. A source with no
 * readable entry has no key.
 *
 * Readability is `getProposal`'s gate (`isProposalReadable`): a draft only for
 * members of the entry's own profile, a hidden or flagged entry also for an
 * instance admin.
 *
 * `isSubmittable` runs the submit checks on each draft entry (one document
 * read each); an entry that is not a draft is never submittable.
 */
export async function getDevelopedProposalsBySource({
  processInstanceId,
  sourceProposalIds,
  readContext,
}: {
  processInstanceId: string;
  sourceProposalIds: string[];
  readContext: ProposalReadContext;
}): Promise<Map<string, DevelopedProposal[]>> {
  const bySource = new Map<string, DevelopedProposal[]>();
  if (sourceProposalIds.length === 0) {
    return bySource;
  }

  const edges = await db.query.proposalRelationships.findMany({
    where: {
      processInstanceId,
      sourceProposalId: { in: sourceProposalIds },
      relationshipType: ProposalRelationshipType.DEVELOPED,
      deletedAt: { isNull: true },
      targetProposal: {
        RAW: (table) => isProposalReadable(table, readContext),
      },
    },
    columns: { sourceProposalId: true },
    with: {
      targetProposal: {
        columns: {
          id: true,
          profileId: true,
          status: true,
          formSchemaId: true,
          proposalData: true,
        },
        with: { profile: { columns: { name: true } } },
      },
    },
    orderBy: { sourceProposalId: 'asc', createdAt: 'asc', id: 'asc' },
  });

  const submittableIds = await getSubmittableDraftIds({
    processInstanceId,
    proposals: edges.map(({ targetProposal }) => targetProposal),
  });

  for (const { sourceProposalId, targetProposal } of edges) {
    // The status column types as `string`; the parse narrows it to the enum.
    const entry = developedProposalSchema.parse({
      id: targetProposal.id,
      profileId: targetProposal.profileId,
      status: targetProposal.status,
      isSubmittable: submittableIds.has(targetProposal.id),
    });
    const entries = bySource.get(sourceProposalId);
    if (entries) {
      entries.push(entry);
    } else {
      bySource.set(sourceProposalId, [entry]);
    }
  }

  return bySource;
}

/** The ids of the drafts that pass the submit checks. */
async function getSubmittableDraftIds({
  processInstanceId,
  proposals,
}: {
  processInstanceId: string;
  proposals: Array<{
    id: string;
    status: string | null;
    formSchemaId: string | null;
    proposalData: unknown;
    profile: { name: string };
  }>;
}): Promise<Set<string>> {
  const drafts = proposals.filter(
    (proposal) => proposal.status === ProposalStatus.DRAFT,
  );
  if (drafts.length === 0) {
    return new Set();
  }

  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { processId: true, profileId: true, instanceData: true },
  });
  if (!instance?.profileId) {
    throw new NotFoundError('Process instance', processInstanceId);
  }
  const { profileId } = instance;

  const results = await pMap(
    drafts,
    async (proposal) => {
      try {
        await assertProposalSubmittable({
          proposal,
          instance: { ...instance, profileId },
        });
        return proposal.id;
      } catch (error) {
        if (error instanceof ValidationError) {
          return null;
        }
        throw error;
      }
    },
    { concurrency: 10 },
  );

  return new Set(results.filter((id) => id !== null));
}
