import { getTextPreview } from '@op/core';
import { Section, Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';

export const ReactionNotificationEmail = ({
  reactorName = 'A Common user',
  postContent: _postContent,
  postUrl = 'https://common.oneproject.org/',
  recipientName: _recipientName,
  contentType = 'post',
  content,
  postedIn,
}: {
  reactorName: string;
  postContent: string;
  postUrl?: string;
  recipientName?: string;
  contentType?: 'post' | 'proposal' | 'comment';
  content: string;
  postedIn?: string;
}) => {
  return (
    <EmailTemplate previewText={`${reactorName} liked your ${contentType}`}>
      <Text className="mb-8 text-lg">
        <strong>{reactorName}</strong> liked your {contentType}:
      </Text>

      <Section className="my-6">
        <Text className="bg-neutral-gray1 my-0 rounded-lg p-4">
          "{getTextPreview({ content, maxLines: 3, maxLength: 200 })}"
        </Text>
      </Section>

      <CtaButton href={postUrl}>View {contentType}</CtaButton>

      {postedIn && <Footnote>Posted in: {postedIn}</Footnote>}
    </EmailTemplate>
  );
};

ReactionNotificationEmail.subject = (
  reactorName: string,
  contentType: 'post' | 'proposal' = 'post',
) => `${reactorName} liked your ${contentType}`;

ReactionNotificationEmail.PreviewProps = {
  reactorName: 'Jordan Rivera',
  postContent:
    'The proposal outlines a phased rollout for the community garden.',
  postUrl: 'https://common.oneproject.org/',
  recipientName: 'Alex',
  contentType: 'proposal',
  content:
    'Here is the proposal text that was liked. It spans a few lines so the preview truncation is visible in the rendered email.',
  postedIn: 'Community Fund',
} satisfies Parameters<typeof ReactionNotificationEmail>[0];

export default ReactionNotificationEmail;
