import { Button, Section, Text } from 'react-email';

import EmailTemplate from '../components/EmailTemplate';
import { Header } from '../components/Header';

export const ProposalSubmittedEmail = ({
  proposalName,
  processTitle,
  proposalUrl = 'https://common.oneproject.org/',
}: {
  proposalName?: string | null;
  processTitle?: string | null;
  proposalUrl: string;
}) => {
  const displayName = proposalName || 'Your proposal';

  return (
    <EmailTemplate
      previewText={
        processTitle
          ? `Your proposal "${displayName}" has been submitted to ${processTitle}`
          : `Your proposal "${displayName}" has been submitted`
      }
    >
      <Header>Proposal Submitted</Header>
      <Text className="my-8 text-lg">
        Your proposal <strong>{displayName}</strong> has been submitted
        {processTitle ? (
          <>
            {' '}
            to <strong>{processTitle}</strong>
          </>
        ) : null}
        .
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
          View proposal
        </Button>
      </Section>
    </EmailTemplate>
  );
};

ProposalSubmittedEmail.subject = (
  proposalName?: string | null,
  processTitle?: string | null,
) => {
  const displayName = proposalName || 'Your proposal';
  if (processTitle) {
    return `Your proposal "${displayName}" has been submitted to ${processTitle}`;
  }
  return `Your proposal "${displayName}" has been submitted`;
};

ProposalSubmittedEmail.PreviewProps = {
  proposalName: 'Community Garden Revamp',
  processTitle: 'Participatory Budgeting 2026',
  proposalUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof ProposalSubmittedEmail>[0];

export default ProposalSubmittedEmail;
