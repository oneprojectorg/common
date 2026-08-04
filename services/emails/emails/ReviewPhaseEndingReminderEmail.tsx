import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

export const ReviewPhaseEndingReminderEmail = ({
  processTitle,
  phaseName,
  remainingCount,
  daysLeft,
  reviewsUrl = 'https://common.oneproject.org/',
}: {
  processTitle: string;
  phaseName: string;
  remainingCount: number;
  daysLeft: number;
  reviewsUrl: string;
}) => {
  return (
    <EmailTemplate
      previewText={`The ${phaseName} phase of ${processTitle} ends in ${formatDaysLeft(daysLeft)} and you still have reviews to complete`}
    >
      <Header>Review phase ending soon</Header>
      <Text className="my-8 text-lg">
        The <strong>{phaseName}</strong> phase of{' '}
        <strong>{processTitle}</strong> ends in{' '}
        <strong>{formatDaysLeft(daysLeft)}</strong>. You still have{' '}
        <strong>
          {remainingCount === 1 ? '1 review' : `${remainingCount} reviews`}
        </strong>{' '}
        left to complete.
      </Text>

      <CtaButton href={reviewsUrl}>Complete your reviews</CtaButton>

      <Footnote>
        You're receiving this because you have review assignments in{' '}
        {processTitle}.
      </Footnote>
    </EmailTemplate>
  );
};

function formatDaysLeft(daysLeft: number) {
  return daysLeft === 1 ? '1 day' : `${daysLeft} days`;
}

ReviewPhaseEndingReminderEmail.subject = (
  processTitle: string,
  daysLeft: number,
) => `Your reviews in "${processTitle}" are due in ${formatDaysLeft(daysLeft)}`;

ReviewPhaseEndingReminderEmail.PreviewProps = {
  processTitle: 'Participatory Budgeting 2026',
  phaseName: 'Review',
  remainingCount: 4,
  daysLeft: 3,
  reviewsUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof ReviewPhaseEndingReminderEmail>[0];

export default ReviewPhaseEndingReminderEmail;
