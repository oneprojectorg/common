import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

export const RevisionResubmittedEmail = ({
  proposalName,
  processTitle,
  proposalUrl = 'https://common.oneproject.org/',
}: {
  proposalName: string;
  processTitle: string;
  proposalUrl: string;
}) => {
  return (
    <EmailTemplate
      previewText={`A revision to "${proposalName}" is ready for your review`}
    >
      <Header>Revision Resubmitted</Header>
      <Text className="my-8 text-lg">
        The author of <strong>{proposalName}</strong> in{' '}
        <strong>{processTitle}</strong> has resubmitted their revision
        addressing your feedback. Take another look at the proposal.
      </Text>

      <CtaButton href={proposalUrl}>View revised proposal</CtaButton>

      <Footnote>
        You're receiving this because you requested changes to this proposal.
      </Footnote>
    </EmailTemplate>
  );
};

RevisionResubmittedEmail.subject = (proposalName: string) =>
  `A revision to "${proposalName}" is ready for your review`;

RevisionResubmittedEmail.PreviewProps = {
  proposalName: 'Community Garden Revamp',
  processTitle: 'Participatory Budgeting 2026',
  proposalUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof RevisionResubmittedEmail>[0];

export default RevisionResubmittedEmail;
