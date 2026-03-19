import { type TransactionType, db, eq } from '@op/db/client';
import {
  profiles,
  proposalCategories,
  proposals,
  taxonomies,
  taxonomyTerms,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError, NotFoundError } from '../../utils';
import { assembleProposalData } from './assembleProposalData';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { parseProposalData } from './proposalDataSchema';
import { assertProposalVersionContext } from './proposalVersionUtils';

/**
 * Sync the `decision_proposal_categories` join table to match a restored
 * category label, using the existing `proposal` taxonomy.
 */
async function updateProposalCategoryLink(
  tx: TransactionType,
  proposalId: string,
  categoryLabel?: string,
): Promise<void> {
  await tx
    .delete(proposalCategories)
    .where(eq(proposalCategories.proposalId, proposalId));

  if (!categoryLabel?.trim()) {
    return;
  }

  const proposalTaxonomy = await tx._query.taxonomies.findFirst({
    where: eq(taxonomies.name, 'proposal'),
  });

  if (!proposalTaxonomy) {
    return;
  }

  const term = await tx._query.taxonomyTerms.findFirst({
    where: eq(taxonomyTerms.label, categoryLabel.trim()),
  });

  if (term) {
    await tx.insert(proposalCategories).values({
      proposalId,
      taxonomyTermId: term.id,
    });
  }
}

/**
 * Reverts a proposal's collaboration document to a previous saved version and
 * syncs system fields (title, category, budget) back to the application database.
 *
 * Steps:
 * 1. Validate permissions (same as editing a proposal)
 * 2. Tell TipTap Cloud to revert the document to the target version
 * 3. Read the reverted document fragments back as plain text
 * 4. Reassemble `proposalData` from those fragments
 * 5. Update the proposals table, profile name, and category link in a transaction
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
  } = await assertProposalVersionContext({
    proposalId,
    user,
  });

  try {
    // 1. Revert the TipTap document to the target version
    await client.revertToVersion(collaborationDocId, versionId, {
      user: currentProfileId,
    });

    // 2. Read the now-reverted fragments as plain text so we can sync system fields
    const fragmentTexts = await client.getDocumentFragments(
      collaborationDocId,
      fragmentNames,
      'text',
    );

    // 3. Merge fragment text into proposal data
    const existingData = parseProposalData(proposal.proposalData);
    const assembledData = proposalTemplate
      ? assembleProposalData(proposalTemplate, fragmentTexts)
      : {};

    const restoredProposalData = parseProposalData({
      ...existingData,
      ...assembledData,
      // System field overrides from fragments
      ...('title' in fragmentTexts
        ? { title: fragmentTexts.title }
        : undefined),
      ...('category' in fragmentTexts
        ? { category: fragmentTexts.category || undefined }
        : undefined),
      collaborationDocId,
    });

    const nextTitle =
      'title' in fragmentTexts ? (fragmentTexts.title ?? '') : undefined;

    // 4. Persist the synced data in a transaction
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

      await updateProposalCategoryLink(
        tx,
        proposalId,
        restoredProposalData.category ?? undefined,
      );

      const syncedProposal = await tx.query.proposals.findFirst({
        where: { id: proposalId },
        with: { profile: true },
      });

      if (!syncedProposal) {
        throw new CommonError('Failed to load restored proposal');
      }

      return syncedProposal;
    });

    // 5. Fetch the document content for the response encoder
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
    if (error instanceof NotFoundError || error instanceof CommonError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes('404')) {
      throw new NotFoundError('Proposal version');
    }

    throw new CommonError('Failed to restore proposal version');
  }
}
