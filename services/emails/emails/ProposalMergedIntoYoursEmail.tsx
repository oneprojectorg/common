import { Link, Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

const inlineLinkClassName = 'font-bold text-primary-teal underline';

/**
 * Goes to the authors of the proposal that survived a merge. The counterpart to
 * {@link ProposalMergedEmail}, which tells the other side their proposal was the
 * one merged away — nobody receives both.
 */
export const ProposalMergedIntoYoursEmail = ({
  proposalName,
  sourceProposalName,
  processTitle,
  proposalUrl = 'https://common.oneproject.org/',
  sourceProposalUrl = 'https://common.oneproject.org/',
}: {
  /** The recipient's own proposal — the one that survived. */
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
        <Link href={sourceProposalUrl} className={inlineLinkClassName}>
          {sourceProposalName}
        </Link>{' '}
        was merged into your proposal{' '}
        <Link href={proposalUrl} className={inlineLinkClassName}>
          {proposalName}
        </Link>{' '}
        in <strong>{processTitle}</strong>. Open your proposal to review what
        was added.
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
