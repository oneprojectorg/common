import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';

export const ContentFlaggedEmail = ({
  recipientName = 'there',
  contentType = 'post',
  contentName,
  contentUrl,
}: {
  recipientName?: string;
  contentType?: 'post' | 'proposal' | 'comment' | 'account';
  /**
   * Title of the flagged item. Absent for items that have no title of their
   * own (posts, comments, accounts). When there's no link to follow, this is
   * the only thing telling an author with several proposals which one this is.
   */
  contentName?: string;
  /**
   * Link to the flagged item. Absent when the item is unreachable — a
   * moderation detach hides it from every query, so a link would only 404.
   */
  contentUrl?: string;
}) => {
  return (
    <EmailTemplate previewText={`Your ${contentType} has been flagged`}>
      <Text className="mb-4 text-lg">Hi {recipientName},</Text>

      <Text className="mb-6">
        Your {contentType}{' '}
        {contentName ? (
          <>
            &ldquo;<strong>{contentName}</strong>&rdquo;{' '}
          </>
        ) : null}
        has been flagged by our moderation system and is being reviewed.
        {/* Only point at the item when there's actually a link to it. */}
        {contentUrl ? ` You can review your ${contentType} below.` : ''}
      </Text>

      {contentUrl && (
        <CtaButton href={contentUrl}>View {contentType}</CtaButton>
      )}
    </EmailTemplate>
  );
};

ContentFlaggedEmail.PreviewProps = {
  recipientName: 'Alex',
  contentType: 'proposal',
  contentName: 'Community Garden Revamp',
  contentUrl: 'https://common.oneproject.org/decisions/pb-2026/proposal/abc123',
} satisfies Parameters<typeof ContentFlaggedEmail>[0];

export default ContentFlaggedEmail;
