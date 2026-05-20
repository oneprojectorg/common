import { Button, Section, Text } from '@react-email/components';

import EmailTemplate from '../components/EmailTemplate';

export const DecisionUpdateNotificationEmail = ({
  authorName = 'A Common user',
  processTitle,
  updateContent,
  updateUrl = 'https://common.oneproject.org/',
}: {
  authorName: string;
  processTitle: string;
  updateContent: string;
  updateUrl: string;
}) => {
  const previewSnippet =
    updateContent.length > 50
      ? `${updateContent.slice(0, 50)}...`
      : updateContent;

  return (
    <EmailTemplate
      previewText={`${authorName} posted an update in ${processTitle}: "${previewSnippet}"`}
    >
      <Text className="my-8 text-lg">
        <strong>{authorName}</strong> posted an update in{' '}
        <strong>{processTitle}</strong>.
      </Text>

      <Section className="my-6">
        <Text className="my-0 text-lg text-neutral-charcoal">
          "{updateContent}"
        </Text>
      </Section>

      <Section className="pb-0">
        <Button
          href={updateUrl}
          className="rounded-lg bg-primary-teal px-4 py-3 text-white no-underline hover:bg-primary-teal/90"
          style={{
            fontSize: '0.875rem',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          View update
        </Button>
      </Section>

      <Text className="mt-8 mb-0 text-xs text-neutral-gray4">
        You're receiving this because you're a participant in {processTitle}.
      </Text>
    </EmailTemplate>
  );
};

DecisionUpdateNotificationEmail.subject = (
  authorName: string,
  processTitle: string,
) => `${authorName} posted an update in ${processTitle}`;

export default DecisionUpdateNotificationEmail;
