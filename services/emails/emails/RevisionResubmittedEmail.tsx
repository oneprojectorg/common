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
      previewText={`A revision to "${proposalName}" is ready for your review`}
    >
      <Heading className="mx-0 !my-0 p-0 text-left font-serif text-[28px] font-light tracking-[-0.02625rem] text-[#222D38]">
        Revision Resubmitted
      </Heading>
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

      <Text className="mt-8 mb-0 text-xs text-neutral-gray4">
        You're receiving this because you requested changes to this proposal.
      </Text>
    </EmailTemplate>
  );
};

RevisionResubmittedEmail.subject = (proposalName: string) =>
  `A revision to "${proposalName}" is ready for your review`;

export default RevisionResubmittedEmail;
