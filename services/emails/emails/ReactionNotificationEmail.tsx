import { getTextPreview } from '@op/core';
import { Button, Section, Text } from '@react-email/components';

import EmailTemplate from '../components/EmailTemplate';

export const ReactionNotificationEmail = ({
  reactorName = 'A Common user',
  postContent: _postContent,
  postUrl = 'https://common.oneproject.org/',
  reactionType,
  recipientName: _recipientName,
  contentType = 'post',
  content,
  postedIn,
}: {
  reactorName: string;
  postContent: string;
  postUrl?: string;
  reactionType: string;
  recipientName?: string;
  contentType?: 'post' | 'proposal' | 'comment';
  content: string;
  postedIn?: string;
}) => {
  return (
    <EmailTemplate
      previewText={`${reactorName} reacted to your ${contentType}`}
    >
      <Text className="mb-8 text-lg">
        <strong>{reactorName}</strong> reacted with {reactionType} to your{' '}
        {contentType}:
      </Text>

      <Section className="my-6">
        <Text className="bg-neutral-gray1 my-0 rounded-lg p-4">
          "{getTextPreview({ content, maxLines: 3, maxLength: 200 })}"
        </Text>
      </Section>

      <Section className="pb-0">
        <Button
          href={postUrl}
          className="bg-primary-teal hover:bg-primary-teal/90 rounded-lg px-4 py-3 text-white no-underline"
          style={{
            fontSize: '0.875rem',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          View {contentType}
        </Button>
      </Section>

      {postedIn && (
        <Text className="text-neutral-gray4 mb-0 mt-1 text-xs">
          Posted in: {postedIn}
        </Text>
      )}
    </EmailTemplate>
  );
};

ReactionNotificationEmail.subject = (
  reactorName: string,
  contentType: 'post' | 'proposal' = 'post',
) => `${reactorName} reacted to your ${contentType}`;

export default ReactionNotificationEmail;
