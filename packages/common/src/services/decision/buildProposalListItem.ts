import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import type { ProposalRelationshipData } from './getProposalRelationshipData';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';

type DocumentContentMap = Awaited<
  ReturnType<typeof getProposalDocumentsContent>
>;

type ProposalTemplate = Awaited<ReturnType<typeof resolveProposalTemplate>>;

/**
 * Flattens the `submittedBy` / `profile` relations (which Drizzle's typings
 * surface as `T | T[]`) and stamps the engagement counts + document content
 * onto the proposal row. Used by both `listProposals` and `listAllProposals`
 * to produce the base shape of a returned list item — callers layer extra
 * fields (e.g. `isEditable`) on top as needed.
 */
export const buildProposalListItem = <
  P extends {
    id: string;
    processInstanceId: string;
    proposalData: unknown;
    status: string | null;
    visibility: string;
    createdAt: string | null;
    updatedAt: string | null;
    profileId: string;
    submittedBy: unknown;
    profile: unknown;
  },
>({
  proposal,
  relationshipData,
  documentContentMap,
  proposalTemplate,
}: {
  proposal: P;
  relationshipData: Map<string, ProposalRelationshipData>;
  documentContentMap: DocumentContentMap;
  proposalTemplate: ProposalTemplate;
}) => {
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
    submittedBy,
    profile,
    likesCount: relationshipInfo?.likesCount || 0,
    followersCount: relationshipInfo?.followersCount || 0,
    isLikedByUser: relationshipInfo?.isLikedByUser || false,
    isFollowedByUser: relationshipInfo?.isFollowedByUser || false,
    commentsCount: relationshipInfo?.commentsCount || 0,
    documentContent: documentContentMap.get(proposal.id),
    proposalTemplate,
  };
};
