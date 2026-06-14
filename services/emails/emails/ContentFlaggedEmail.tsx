import { Button, Section, Text } from '@react-email/components';

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

      {disputeUrl && (
        <Section className="pb-0">
          <Button
            href={disputeUrl}
            className="rounded-lg bg-primary-teal px-4 py-3 text-white no-underline hover:bg-primary-teal/90"
            style={{
              fontSize: '0.875rem',
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            Review or dispute
          </Button>
        </Section>
      )}
    </EmailTemplate>
  );
};

export default ContentFlaggedEmail;
