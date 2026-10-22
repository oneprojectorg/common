import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

export const ReviewSubmittedEmail = ({
  proposalName,
  processTitle,
  reviewUrl = 'https://common.oneproject.org/',
}: {
  proposalName: string;
  processTitle: string;
  reviewUrl: string;
}) => {
  return (
    <EmailTemplate
      previewText={`Your review of "${proposalName}" was recorded`}
    >
      <Header>Your review is in!</Header>
      <Text className="my-8 text-lg">
        Thank you for reviewing <strong>{proposalName}</strong> in{' '}
        <strong>{processTitle}</strong>. Your review has been recorded.
      </Text>

      <CtaButton href={reviewUrl}>View your review</CtaButton>

      <Footnote>
        You&apos;re receiving this because you submitted a review in this
        process.
      </Footnote>
    </EmailTemplate>
  );
};

ReviewSubmittedEmail.subject = (proposalName: string) =>
  `Your review of "${proposalName}" was recorded`;

ReviewSubmittedEmail.PreviewProps = {
  proposalName: 'Community Garden Revamp',
  processTitle: 'Participatory Budgeting 2026',
  reviewUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof ReviewSubmittedEmail>[0];

export default ReviewSubmittedEmail;
