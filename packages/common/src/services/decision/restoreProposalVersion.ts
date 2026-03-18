import { type TransactionType, db, eq } from '@op/db/client';
import {
  profiles,
  proposalCategories,
  proposals,
  taxonomyTerms,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError, NotFoundError } from '../../utils';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import {
  getProposalVersionContext,
  mergeRestoredProposalData,
} from './proposalVersionUtils';

async function updateProposalCategoryLink(
  tx: TransactionType,
  proposalId: string,
  categoryTermId?: string,
): Promise<void> {
  await tx
    .delete(proposalCategories)
    .where(eq(proposalCategories.proposalId, proposalId));

  if (!categoryTermId) {
    return;
  }

  await tx.insert(proposalCategories).values({
    proposalId,
    taxonomyTermId: categoryTermId,
  });
}

/**
 * Reverts a proposal collaboration document to a previous saved version and
 * syncs system fields that are also persisted in the application database.
 */
export async function restoreProposalVersion({
  proposalId,
  user,
  versionId,
}: {
  proposalId: string;
  user: User;
  versionId: number;
}) {
  const {
    client,
    collaborationDocId,
    currentProfileId,
    fragmentNames,
    proposal,
    proposalTemplate,
  } = await getProposalVersionContext({
    proposalId,
    user,
  });

  try {
    await client.revertToVersion(collaborationDocId, versionId, {
      user: currentProfileId,
    });

    const fragmentTexts = await client.getDocumentFragments(
      collaborationDocId,
      fragmentNames,
      'text',
    );

    const restoredProposalData = mergeRestoredProposalData({
      collaborationDocId,
      existingProposalData: proposal.proposalData,
      fragmentTexts,
      proposalTemplate,
    });
    const nextTitle =
      'title' in fragmentTexts ? (fragmentTexts.title ?? '') : undefined;
    const categoryTerm =
      typeof restoredProposalData.category === 'string' &&
      restoredProposalData.category.trim()
        ? await db._query.taxonomyTerms.findFirst({
            where: eq(
              taxonomyTerms.label,
              restoredProposalData.category.trim(),
            ),
          })
        : null;

    const updatedProposal = await db.transaction(async (tx) => {
      const [proposalRow] = await tx
        .update(proposals)
        .set({
          proposalData: restoredProposalData,
          lastEditedByProfileId: currentProfileId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(proposals.id, proposalId))
        .returning();

      if (!proposalRow) {
        throw new CommonError('Failed to sync restored proposal version');
      }

      if (nextTitle !== undefined) {
        await tx
          .update(profiles)
          .set({
            name: nextTitle,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(profiles.id, proposal.profileId));
      }

      await updateProposalCategoryLink(tx, proposalId, categoryTerm?.id);

      const syncedProposal = await tx.query.proposals.findFirst({
        where: { id: proposalId },
        with: { profile: true },
      });

      if (!syncedProposal) {
        throw new CommonError('Failed to load restored proposal');
      }

      return syncedProposal;
    });

    const documentContent = await getProposalDocumentsContent([
      {
        id: updatedProposal.id,
        proposalData: updatedProposal.proposalData,
        proposalTemplate,
      },
    ]).then((documents) => documents.get(updatedProposal.id));

    return {
      ...updatedProposal,
      documentContent,
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes('404')) {
      throw new NotFoundError('Proposal version');
    }

    throw new CommonError('Failed to restore proposal version');
  }
}
