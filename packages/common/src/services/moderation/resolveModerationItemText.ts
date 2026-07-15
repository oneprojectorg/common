import { getTipTapClient } from '@op/collab';
import { db, eq } from '@op/db/client';
import { posts } from '@op/db/schema';
import { logger } from '@op/logging';

import { assembleProposalData } from '../decision/assembleProposalData';
import { extractProposalText } from '../decision/extractProposalText';
import { getProposalFragmentNames } from '../decision/getProposalFragmentNames';
import { parseProposalData } from '../decision/proposalDataSchema';
import { resolveProposalTemplate } from '../decision/resolveProposalTemplate';
import type { ModerationItemType } from './types';

const recordOf = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(Object.entries(value));
};

/**
 * The moderatable text of an item: a post's body, or all of a proposal's
 * prose fields. Users carry no moderatable text here.
 *
 * For collab-doc proposals the prose lives in the TipTap document, not in
 * `proposalData` — reading only the stored record would submit an empty
 * string to the provider. So the document's template fragments are fetched
 * (as plain text) and merged over the stored record, mirroring how
 * `validateProposalAgainstTemplate` assembles its validation data. A TipTap
 * failure falls back to the stored record rather than blocking moderation.
 */
export const resolveModerationItemText = async (
  itemType: ModerationItemType,
  itemId: string,
): Promise<string> => {
  if (itemType === 'post') {
    const [row] = await db
      .select({ content: posts.content })
      .from(posts)
      .where(eq(posts.id, itemId))
      .limit(1);
    return row?.content ?? '';
  }

  if (itemType === 'proposal') {
    const proposal = await db.query.proposals.findFirst({
      where: { id: itemId },
      with: { processInstance: true },
    });
    if (!proposal) {
      return '';
    }

    const stored = recordOf(proposal.proposalData);
    const parsed = parseProposalData(proposal.proposalData);
    if (!parsed.collaborationDocId) {
      return extractProposalText(stored);
    }

    try {
      const template = await resolveProposalTemplate(
        recordOf(proposal.processInstance.instanceData),
        proposal.processInstance.processId,
      );
      // Legacy single-fragment docs (no template) store everything under
      // `default`; template-driven docs have one fragment per field.
      const fragmentNames = template
        ? getProposalFragmentNames(template)
        : ['default'];
      const fragmentTexts = await getTipTapClient().getDocumentFragments(
        parsed.collaborationDocId,
        fragmentNames,
        { format: 'text' },
      );
      const assembled = template
        ? assembleProposalData(template, fragmentTexts)
        : fragmentTexts;
      return extractProposalText({ ...stored, ...recordOf(assembled) });
    } catch (error) {
      logger.error('Falling back to stored proposalData for moderation text', {
        error,
      });
      return extractProposalText(stored);
    }
  }

  return '';
};
