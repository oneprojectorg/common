import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

export const ReviewReminderEmail = ({
  processTitle,
  message,
  reviewsUrl,
}: {
  processTitle: string;
  message: string;
  reviewsUrl: string;
}) => {
  return (
    <EmailTemplate
      previewText={`A reminder about your reviews in ${processTitle}`}
    >
      <Header>A reminder about your reviews</Header>

      <Text className="my-8 text-lg whitespace-pre-line">{message}</Text>

      <CtaButton href={reviewsUrl}>Open your reviews</CtaButton>

      <Footnote>
        You're receiving this because you have review assignments in{' '}
        {processTitle}.
      </Footnote>
    </EmailTemplate>
  );
};

ReviewReminderEmail.subject = (processTitle: string) =>
  `Reminder: your reviews in "${processTitle}"`;

ReviewReminderEmail.PreviewProps = {
  processTitle: 'Participatory Budgeting 2026',
  message:
    'Hi Ada,\n\nYou still have 4 proposals left to review. Please submit your reviews before the phase ends.\n\nThank you.',
  reviewsUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof ReviewReminderEmail>[0];

export default ReviewReminderEmail;
