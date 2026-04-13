import { Button, Heading, Section, Text } from '@react-email/components';

import EmailTemplate from '../components/EmailTemplate';

export const PhaseTransitionEmail = ({
  processTitle,
  fromPhaseName,
  toPhaseName,
  processUrl = 'https://common.oneproject.org/',
}: {
  processTitle: string;
  fromPhaseName: string;
  toPhaseName: string;
  processUrl: string;
}) => {
  return (
    <EmailTemplate previewText={`${processTitle} has moved to ${toPhaseName}`}>
      <Heading className="mx-0 !my-0 p-0 text-left font-serif text-[28px] font-light tracking-[-0.02625rem] text-[#222D38]">
        Phase Update
      </Heading>
      <Text className="my-8 text-lg">
        <strong>{processTitle}</strong> has moved from{' '}
        <strong>{fromPhaseName}</strong> to <strong>{toPhaseName}</strong>.
      </Text>

      <Section className="pb-0">
        <Button
          href={processUrl}
          className="rounded-lg bg-primary-teal px-4 py-3 text-white no-underline hover:bg-primary-teal/90"
          style={{
            fontSize: '0.875rem',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          View process
        </Button>
      </Section>
    </EmailTemplate>
  );
};

PhaseTransitionEmail.subject = (processTitle: string, toPhaseName: string) =>
  `Phase update: ${processTitle} has moved to ${toPhaseName}`;

export default PhaseTransitionEmail;
