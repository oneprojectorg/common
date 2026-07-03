import { Button, Section, Text } from 'react-email';

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
          Revise proposal
        </Button>
      </Section>

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
