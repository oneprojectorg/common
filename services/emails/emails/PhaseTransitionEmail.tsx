import { Button, Section, Text } from '@react-email/components';

import EmailTemplate from '../components/EmailTemplate';

export const PhaseTransitionEmail = ({
  processTitle,
  toPhaseName,
  phaseNumber,
  totalPhases,
  processUrl = 'https://common.oneproject.org/',
}: {
  processTitle: string;
  toPhaseName: string;
  phaseNumber: number;
  totalPhases: number;
  processUrl: string;
}) => {
  return (
    <EmailTemplate
      previewText={`${processTitle} has moved to phase ${phaseNumber} of ${totalPhases}: ${toPhaseName}.`}
    >
      <Text className="my-8 text-lg">
        <strong>{processTitle}</strong> has moved to phase {phaseNumber} of{' '}
        {totalPhases}: <strong>{toPhaseName}</strong>.
      </Text>

      <Section className="pb-0">
        <Button
          href={processUrl}
          className="rounded-lg bg-primary px-4 py-3 text-white no-underline hover:bg-primary/90"
          style={{
            fontSize: '0.875rem',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          View process
        </Button>
      </Section>

      <Text className="mt-8 mb-0 text-xs text-muted-foreground">
        You're receiving this because you're a participant in {processTitle}.
      </Text>
    </EmailTemplate>
  );
};

PhaseTransitionEmail.subject = (processTitle: string, toPhaseName: string) =>
  `${processTitle} — now in ${toPhaseName}`;

export default PhaseTransitionEmail;
