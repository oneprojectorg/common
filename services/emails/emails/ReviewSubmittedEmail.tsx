import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

export const ReviewSubmittedEmail = ({
  proposalName,
  processTitle,
  reviewsUrl = 'https://common.oneproject.org/',
  completedCount,
  totalCount,
}: {
  proposalName: string;
  processTitle: string;
  reviewsUrl: string;
  completedCount?: number;
  totalCount?: number;
}) => {
  const showProgress =
    typeof completedCount === 'number' &&
    typeof totalCount === 'number' &&
    totalCount > 0;

  return (
    <EmailTemplate
      previewText={`Your review of "${proposalName}" was recorded`}
    >
      <Header>Your review is in!</Header>
      <Text className="my-8 text-lg">
        Thank you for reviewing <strong>{proposalName}</strong> in{' '}
        <strong>{processTitle}</strong>. Your review has been recorded.
      </Text>

      {showProgress && (
        <Text className="mb-8 text-lg">
          You've completed {completedCount} of {totalCount}{' '}
          {totalCount === 1 ? 'review' : 'reviews'} in this phase.
        </Text>
      )}

      <CtaButton href={reviewsUrl}>View your reviews</CtaButton>

      <Footnote>
        You're receiving this because you submitted a review in this process.
      </Footnote>
    </EmailTemplate>
  );
};

ReviewSubmittedEmail.subject = (proposalName: string) =>
  `Your review of "${proposalName}" was recorded`;

ReviewSubmittedEmail.PreviewProps = {
  proposalName: 'Community Garden Revamp',
  processTitle: 'Participatory Budgeting 2026',
  reviewsUrl: 'https://common.oneproject.org/',
  completedCount: 3,
  totalCount: 8,
} satisfies Parameters<typeof ReviewSubmittedEmail>[0];

export default ReviewSubmittedEmail;
