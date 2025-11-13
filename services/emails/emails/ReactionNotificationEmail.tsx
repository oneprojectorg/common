import { Button, CodeBlock, Section, Text } from '@react-email/components';
import * as React from 'react';

import EmailTemplate from '../components/EmailTemplate';

export const ReactionNotificationEmail = ({
  reactorName = 'A Common user',
  postContent: _postContent,
  postUrl = 'https://common.oneproject.org/',
  reactionType,
  recipientName: _recipientName,
  contentType = 'post',
  contextName,
  postedIn,
}: {
  reactorName: string;
  postContent: string;
  postUrl?: string;
  reactionType: string;
  recipientName?: string;
  contentType?: 'post' | 'proposal' | 'comment';
  contextName?: string;
  postedIn?: string;
}) => {
  return (
    <EmailTemplate
      previewText={`${reactorName} reacted to your ${contentType}`}
    >
      <Text className="my-8 text-lg">
        <strong>{reactorName}</strong> reacted to your {contentType} with{' '}
        {reactionType}.
      </Text>

      <Section className="my-6">
        <Text className="my-0 bg-[#FAFBFB] p-4 text-lg text-[#222D38]">
          "{contextName}"
        </Text>
      </Section>

      <Section className="pb-0">
        <Button
          href={postUrl}
          className="rounded-lg bg-[#0396A6] px-4 py-3 text-white no-underline hover:bg-[#0396A6]/90"
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
        <Text className="mb-0 mt-1 text-xs text-[#606A6C]">
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
