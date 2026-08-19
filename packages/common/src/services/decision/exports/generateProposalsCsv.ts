import { stringify } from 'csv-stringify/sync';

import type { listProposals } from '../listProposals';
import {
  formatProposalCategories,
  getPlaceCoordinates,
  parseProposalData,
} from '../proposalDataSchema';
import { collectProposalBodyDoc } from '../proposalListPreview';
import { tiptapDocToPlainText } from '../tiptapDocToPlainText';

// Infer the proposal type from the listProposals return value
type ProposalFromList = Awaited<
  ReturnType<typeof listProposals>
>['proposals'][number];

/**
 * Plain text of a proposal's body, for the Description column.
 *
 * Reads the same fragments the list preview and the proposal page render, via
 * the shared walk. It previously read only `fragments.default` — the legacy
 * single-fragment shape — so every proposal on a template exported an empty
 * description while legacy proposals kept working, which is why it went
 * unnoticed. Templated documents key their fragments by field name (`summary`
 * for the current templates).
 */
function getDocumentDescription(proposal: ProposalFromList): string {
  const documentContent = proposal.documentContent;

  if (documentContent?.type === 'json') {
    const bodyDoc = collectProposalBodyDoc({
      fragments: documentContent.fragments,
      proposalTemplate: proposal.proposalTemplate ?? null,
    });

    if (!bodyDoc) {
      return '';
    }

    try {
      return tiptapDocToPlainText(bodyDoc).trim();
    } catch {
      return '';
    }
  }

  const proposalData = parseProposalData(proposal.proposalData);
  return proposalData.description?.trim() || '';
}

export async function generateProposalsCsv(
  proposals: ProposalFromList[],
): Promise<string> {
  const rows = proposals.map((p) => {
    // Deferred: the non-description fields still come from the stored
    // `proposalData` snapshot, which goes stale once a field is edited in the
    // collab doc. The authoritative values live in TipTap and want the same
    // REST fetch `getDocumentDescription` already does above.
    const proposalData = parseProposalData(p.proposalData);

    // Geocoded place coordinates, so co-located ideas plot on one point rather
    // than scattering by however precisely each submitter dropped their pin.
    // `getPlaceCoordinates` falls back to the pin when the geocoder found no
    // match — emitting blanks there would silently drop those ideas off the
    // map, which is the opposite of what this export is for.
    const place = proposalData.location
      ? getPlaceCoordinates(proposalData.location)
      : undefined;

    return {
      'Proposal ID': p.id,
      Title: p.profile?.name || '',
      Description: getDocumentDescription(p),
      Budget: proposalData.budget?.amount ?? '',
      Currency: proposalData.budget?.currency ?? '',
      Categories: formatProposalCategories(proposalData.category),
      Address: proposalData.location?.address ?? '',
      Latitude: place?.lat ?? '',
      Longitude: place?.lng ?? '',
      Status: p.status,
      'Submitted By': p.submittedBy?.name || '',
      'Profile ID': p.profileId,
      Likes: p.likesCount || 0,
      Comments: p.commentsCount || 0,
      Followers: p.followersCount || 0,
      'Created At': p.createdAt ? new Date(p.createdAt).toISOString() : '',
      'Updated At': p.updatedAt ? new Date(p.updatedAt).toISOString() : '',
    };
  });

  return stringify(rows, {
    header: true,
    quoted: true,
  });
}
