import { Button, Heading, Section, Text } from '@react-email/components';

import EmailTemplate from '../components/EmailTemplate';

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
      <Heading className="mx-0 !my-0 p-0 text-left font-serif text-[28px] font-light tracking-[-0.02625rem] text-[#222D38]">
        Revision Requested
      </Heading>
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

      <Text className="mt-8 mb-0 text-xs text-neutral-gray4">
        You're receiving this because you're the author of this proposal.
      </Text>
    </EmailTemplate>
  );
};

RevisionRequestedEmail.subject = (proposalName: string) =>
  `A reviewer has requested changes to "${proposalName}"`;

export default RevisionRequestedEmail;
