import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

export const RevisionResubmittedConfirmationEmail = ({
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
      previewText={`Your revision to "${proposalName}" has been submitted`}
    >
      <Header>Revision Submitted</Header>
      <Text className="my-8 text-lg">
        Your revision to <strong>{proposalName}</strong> in{' '}
        <strong>{processTitle}</strong> has been submitted. The reviewer who
        requested changes has been notified and will take another look at your
        proposal.
      </Text>

      <CtaButton href={proposalUrl}>View proposal</CtaButton>

      <Footnote>
        You're receiving this because you're a collaborator on this proposal.
      </Footnote>
    </EmailTemplate>
  );
};

RevisionResubmittedConfirmationEmail.subject = (proposalName: string) =>
  `Your revision to "${proposalName}" has been submitted`;

RevisionResubmittedConfirmationEmail.PreviewProps = {
  proposalName: 'Community Garden Revamp',
  processTitle: 'Participatory Budgeting 2026',
  proposalUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof RevisionResubmittedConfirmationEmail>[0];

export default RevisionResubmittedConfirmationEmail;
