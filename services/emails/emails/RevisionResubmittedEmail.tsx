import { Button, Section, Text } from 'react-email';

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

      <Section className="pb-0">
        <Button
          href={proposalUrl}
          className="rounded-lg bg-primary-teal px-4 py-3 text-white no-underline hover:bg-primary-teal/90"
          style={{
            fontSize: '0.875rem',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          View revised proposal
        </Button>
      </Section>

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
