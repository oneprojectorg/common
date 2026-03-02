import { Button, Heading, Section, Text } from '@react-email/components';

import EmailTemplate from '../components/EmailTemplate';

export const ProposalSubmittedEmail = ({
  proposalName = 'Your proposal',
  processTitle = 'a decision process',
  proposalUrl = 'https://common.oneproject.org/',
}: {
  proposalName: string;
  processTitle: string;
  proposalUrl: string;
}) => {
  return (
    <EmailTemplate
      previewText={`Your proposal "${proposalName}" has been submitted to ${processTitle}`}
    >
      <Heading className="mx-0 !my-0 p-0 text-left font-serif text-[28px] font-light tracking-[-0.02625rem] text-[#222D38]">
        Proposal Submitted
      </Heading>
      <Text className="my-8 text-lg">
        Your proposal <strong>{proposalName}</strong> has been submitted to{' '}
        <strong>{processTitle}</strong>.
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

ProposalSubmittedEmail.subject = (proposalName: string, processTitle: string) =>
  `Your proposal "${proposalName}" has been submitted to ${processTitle}`;

export default ProposalSubmittedEmail;
