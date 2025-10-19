import type { proposalEncoder } from '@op/api/encoders';
import { stringify } from 'csv-stringify/sync';
import type { z } from 'zod';

type Proposal = z.infer<typeof proposalEncoder>;

export async function generateProposalsCsv(proposals: Proposal[]): Promise<string> {
  const rows = proposals.map((p) => {
    const proposalData = p.proposalData || {};

    return {
      'Proposal ID': p.id,
      Title: proposalData.title || '',
      Description: proposalData.description || '',
      Budget: proposalData.budget || '',
      Status: p.status,
      'Submitted By': p.submittedBy?.name || '',
      'Submitter Email': p.submittedBy?.email || '',
      'Profile ID': p.profileId,
      Votes: p.decisionCount || 0,
      Likes: p.likesCount || 0,
      Comments: p.commentsCount || 0,
      Followers: p.followersCount || 0,
      'Created At': new Date(p.createdAt).toISOString(),
      'Updated At': new Date(p.updatedAt).toISOString(),
    };
  });

  return stringify(rows, {
    header: true,
    quoted: true,
  });
}
