import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';
import { InlineLink } from '../components/InlineLink';

/** Goes to the authors of the proposal that survived; nobody receives both. */
export const ProposalMergedIntoYoursEmail = ({
  proposalName,
  sourceProposalName,
  processTitle,
  proposalUrl = 'https://common.oneproject.org/',
  sourceProposalUrl = 'https://common.oneproject.org/',
}: {
  /** The recipient's own proposal. */
  proposalName: string;
  sourceProposalName: string;
  processTitle: string;
  proposalUrl: string;
  sourceProposalUrl: string;
}) => {
  return (
    <EmailTemplate previewText={`A proposal was merged into "${proposalName}"`}>
      <Header>Proposal Merged</Header>
      <Text className="my-8 text-lg">
        <InlineLink href={sourceProposalUrl}>{sourceProposalName}</InlineLink>{' '}
        was merged into your proposal{' '}
        <InlineLink href={proposalUrl}>{proposalName}</InlineLink> in{' '}
        <strong>{processTitle}</strong>. Open your proposal to review what was
        added.
      </Text>

      <CtaButton href={proposalUrl}>View proposal</CtaButton>

      <Footnote>
        You're receiving this because you're an author of this proposal.
      </Footnote>
    </EmailTemplate>
  );
};

ProposalMergedIntoYoursEmail.subject = (proposalName: string) =>
  `A proposal was merged into "${proposalName}"`;

ProposalMergedIntoYoursEmail.PreviewProps = {
  proposalName: 'Neighbourhood Green Spaces',
  sourceProposalName: 'Community Garden Revamp',
  processTitle: 'Participatory Budgeting 2026',
  proposalUrl: 'https://common.oneproject.org/',
  sourceProposalUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof ProposalMergedIntoYoursEmail>[0];

export default ProposalMergedIntoYoursEmail;
