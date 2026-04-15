import { Button, Heading, Section, Text } from '@react-email/components';

import EmailTemplate from '../components/EmailTemplate';

interface NextStep {
  name: string;
  date?: string;
}

export const VoteSubmittedEmail = ({
  processTitle,
  decisionUrl = 'https://common.oneproject.org/',
  nextSteps = [],
}: {
  processTitle?: string | null;
  decisionUrl: string;
  nextSteps?: NextStep[];
}) => {
  return (
    <EmailTemplate
      previewText={
        processTitle
          ? `Your ballot is in! Thank you for participating in the ${processTitle}.`
          : 'Your ballot is in!'
      }
    >
      <Heading className="mx-0 !my-0 p-0 text-center font-serif text-[28px] font-light tracking-[-0.02625rem] text-[#222D38]">
        Your ballot is in!
      </Heading>

      <Text className="mt-4 mb-6 text-center text-base">
        {processTitle ? (
          <>
            Thank you for participating in the <strong>{processTitle}</strong>.
            Your voice helps shape how we invest in our community.
          </>
        ) : (
          'Thank you for participating. Your voice helps shape how we invest in our community.'
        )}
      </Text>

      {nextSteps.length > 0 && (
        <Section className="mt-2 mb-4 text-left">
          <Text className="mb-2 text-base font-semibold">
            Here&apos;s what will happen next:
          </Text>
          {nextSteps.map((step) => (
            <Text key={step.name} className="my-1 pl-2 text-base">
              &bull; {step.date ? `${step.name} on ${step.date}` : step.name}
            </Text>
          ))}
        </Section>
      )}

      <Section className="pt-4 pb-0 text-center">
        <Button
          href={decisionUrl}
          className="w-full rounded-lg bg-primary-teal px-4 py-3 text-center text-white no-underline hover:bg-primary-teal/90"
          style={{
            display: 'block',
            width: '100%',
            fontSize: '0.875rem',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          View all proposals
        </Button>
      </Section>
    </EmailTemplate>
  );
};

VoteSubmittedEmail.subject = (processTitle?: string | null) => {
  if (processTitle) {
    return `Your ballot is in! — ${processTitle}`;
  }
  return 'Your ballot is in!';
};

export default VoteSubmittedEmail;
