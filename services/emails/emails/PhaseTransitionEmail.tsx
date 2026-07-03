import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';

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

      <CtaButton href={processUrl}>View process</CtaButton>

      <Footnote>
        You're receiving this because you're a participant in {processTitle}.
      </Footnote>
    </EmailTemplate>
  );
};

PhaseTransitionEmail.subject = (processTitle: string, toPhaseName: string) =>
  `${processTitle} — now in ${toPhaseName}`;

PhaseTransitionEmail.PreviewProps = {
  processTitle: 'Participatory Budgeting 2026',
  toPhaseName: 'Voting',
  phaseNumber: 3,
  totalPhases: 5,
  processUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof PhaseTransitionEmail>[0];

export default PhaseTransitionEmail;
