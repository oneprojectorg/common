import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

export const RevisionRequestedEmail = ({
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
      previewText={`A reviewer has requested changes to "${proposalName}"`}
    >
      <Header>Revision Requested</Header>
      <Text className="my-8 text-lg">
        A reviewer has requested changes to your proposal{' '}
        <strong>{proposalName}</strong> in <strong>{processTitle}</strong>.
        Review their feedback and submit your revision.
      </Text>

      <CtaButton href={proposalUrl}>Revise proposal</CtaButton>

      <Footnote>
        You're receiving this because you're the author of this proposal.
      </Footnote>
    </EmailTemplate>
  );
};

RevisionRequestedEmail.subject = (proposalName: string) =>
  `A reviewer has requested changes to "${proposalName}"`;

RevisionRequestedEmail.PreviewProps = {
  proposalName: 'Community Garden Revamp',
  processTitle: 'Participatory Budgeting 2026',
  proposalUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof RevisionRequestedEmail>[0];

export default RevisionRequestedEmail;
