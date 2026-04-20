import { Button, Heading, Section, Text } from '@react-email/components';

import EmailTemplate from '../components/EmailTemplate';

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
      previewText={`Your revision for "${proposalName}" has been resubmitted for review`}
    >
      <Heading className="mx-0 !my-0 p-0 text-left font-serif text-[28px] font-light tracking-[-0.02625rem] text-[#222D38]">
        Revision Resubmitted
      </Heading>
      <Text className="my-8 text-lg">
        Your revision for <strong>{proposalName}</strong> in{' '}
        <strong>{processTitle}</strong> has been resubmitted. Reviewers will
        take another look and follow up with their decision.
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

      <Text className="mt-8 mb-0 text-xs text-neutral-gray4">
        You're receiving this because you're the author of this proposal.
      </Text>
    </EmailTemplate>
  );
};

RevisionResubmittedEmail.subject = (proposalName: string) =>
  `Your revision for "${proposalName}" has been resubmitted`;

export default RevisionResubmittedEmail;
