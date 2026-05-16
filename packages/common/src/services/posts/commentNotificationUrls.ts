export const buildProposalCommentUrl = ({
  baseUrl,
  decisionSlug,
  proposalProfileId,
}: {
  baseUrl: string;
  decisionSlug: string | null | undefined;
  proposalProfileId: string;
}): string | null => {
  if (!decisionSlug) {
    return null;
  }
  return `${baseUrl}/decisions/${decisionSlug}/proposal/${proposalProfileId}`;
};
