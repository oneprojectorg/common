import { Button, Heading, Section, Text } from '@react-email/components';

import EmailTemplate from '../components/EmailTemplate';

export const VoteSubmittedEmail = ({
  processTitle,
  decisionUrl = 'https://common.oneproject.org/',
}: {
  processTitle?: string | null;
  decisionUrl: string;
}) => {
  return (
    <EmailTemplate
      previewText={
        processTitle
          ? `Your vote has been submitted for ${processTitle}`
          : 'Your vote has been submitted'
      }
    >
      <Heading className="mx-0 !my-0 p-0 text-left font-serif text-[28px] font-light tracking-[-0.02625rem] text-[#222D38]">
        Vote Submitted
      </Heading>
      <Text className="my-8 text-lg">
        Your vote has been submitted
        {processTitle ? (
          <>
            {' '}
            for <strong>{processTitle}</strong>
          </>
        ) : null}
        .
      </Text>

      <Section className="pb-0">
        <Button
          href={decisionUrl}
          className="rounded-lg bg-primary-teal px-4 py-3 text-white no-underline hover:bg-primary-teal/90"
          style={{
            fontSize: '0.875rem',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          View decision
        </Button>
      </Section>
    </EmailTemplate>
  );
};

VoteSubmittedEmail.subject = (processTitle?: string | null) => {
  if (processTitle) {
    return `Your vote has been submitted for ${processTitle}`;
  }
  return 'Your vote has been submitted';
};

export default VoteSubmittedEmail;
