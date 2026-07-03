import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';

export const ContentFlaggedEmail = ({
  recipientName = 'there',
  contentType = 'post',
  disputeUrl,
}: {
  recipientName?: string;
  contentType?: 'post' | 'proposal' | 'comment' | 'account';
  disputeUrl?: string;
}) => {
  return (
    <EmailTemplate previewText={`Your ${contentType} has been flagged`}>
      <Text className="mb-4 text-lg">Hi {recipientName},</Text>

      <Text className="mb-6">
        Your {contentType} has been flagged by our moderation system and is
        being reviewed.
        {/* Only promise a dispute path when there's actually a link to one. */}
        {disputeUrl
          ? ' If you believe this was a mistake, you can dispute the decision.'
          : ''}
      </Text>

      {disputeUrl && <CtaButton href={disputeUrl}>Review or dispute</CtaButton>}
    </EmailTemplate>
  );
};

ContentFlaggedEmail.PreviewProps = {
  recipientName: 'Alex',
  contentType: 'proposal',
  disputeUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof ContentFlaggedEmail>[0];

export default ContentFlaggedEmail;
