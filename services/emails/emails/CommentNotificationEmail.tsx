import { Button, Section, Text } from '@react-email/components';

import EmailTemplate from '../components/EmailTemplate';

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
        <strong>{commenterName}</strong> commented on your {contentType}.
      </Text>

      <Section className="my-6">
        <Text className="text-neutral-charcoal my-0 text-lg">
          "{commentContent}"
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
          View comment
        </Button>
      </Section>

      {contextName && (
        <Text className="text-neutral-gray4 mb-0 text-xs">
          Context: {contextName}
        </Text>
      )}
      {postedIn && (
        <Text className="text-neutral-gray4 mb-0 mt-1 text-xs">
          Posted in: {postedIn}
        </Text>
      )}
    </EmailTemplate>
  );
};

CommentNotificationEmail.subject = (
  commenterName: string,
  contentType: 'post' | 'proposal' = 'post',
) => `${commenterName} commented on your ${contentType}`;

export default CommentNotificationEmail;
