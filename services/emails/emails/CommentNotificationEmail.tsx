import { Section, Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';

export const CommentNotificationEmail = ({
  commenterName = 'A Common user',
  postContent: _postContent,
  commentContent,
  postUrl = 'https://common.oneproject.org/',
  recipientName: _recipientName,
  contentType = 'post',
  contextName,
  postedIn,
}: {
  commenterName: string;
  postContent: string;
  commentContent: string;
  postUrl: string;
  recipientName?: string;
  contentType?: 'post' | 'proposal';
  contextName?: string;
  postedIn?: string;
}) => {
  return (
    <EmailTemplate
      previewText={`${commenterName} commented on your ${contentType}: "${commentContent.slice(0, 50)}${commentContent.length > 50 ? '...' : ''}"`}
    >
      <Text className="my-8 text-lg">
        <strong>{commenterName}</strong> commented on your{' '}
        <strong>{contentType}</strong>.
      </Text>

      <Section className="my-6">
        <Text className="text-neutral-charcoal my-0 text-lg wrap-anywhere whitespace-pre-wrap">
          "{commentContent}"
        </Text>
      </Section>

      <CtaButton href={postUrl}>View comment</CtaButton>

      {contextName && <Footnote>Context: {contextName}</Footnote>}
      {postedIn && <Footnote className="mt-1">Posted in: {postedIn}</Footnote>}
    </EmailTemplate>
  );
};

CommentNotificationEmail.subject = (
  commenterName: string,
  contentType: 'post' | 'proposal' = 'post',
) => `${commenterName} commented on your ${contentType}`;

CommentNotificationEmail.PreviewProps = {
  commenterName: 'Jordan Rivera',
  postContent:
    'The proposal outlines a phased rollout for the community garden.',
  commentContent:
    "This is a thoughtful point — I hadn't considered the downstream effects on the budget timeline. Could we revisit phase two?",
  postUrl: 'https://common.oneproject.org/',
  recipientName: 'Alex',
  contentType: 'proposal',
  contextName: 'Participatory Budgeting 2026',
  postedIn: 'Community Fund',
} satisfies Parameters<typeof CommentNotificationEmail>[0];

export default CommentNotificationEmail;
