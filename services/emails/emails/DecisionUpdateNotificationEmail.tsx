import { Section, Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';

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
        <Text className="text-neutral-charcoal my-0 text-lg wrap-anywhere whitespace-pre-wrap">
          "{updateContent}"
        </Text>
      </Section>

      <CtaButton href={updateUrl}>View update</CtaButton>

      <Footnote>
        You're receiving this because you're a participant in {processTitle}.
      </Footnote>
    </EmailTemplate>
  );
};

DecisionUpdateNotificationEmail.subject = (
  authorName: string,
  processTitle: string,
) => `${authorName} posted an update in ${processTitle}`;

DecisionUpdateNotificationEmail.PreviewProps = {
  authorName: 'Jordan Rivera',
  processTitle: 'Participatory Budgeting 2026',
  updateContent:
    "Don't forget to come to the party! Details here: https://example.com/events/participatory-budgeting-kickoff?utm_source=email&utm_medium=notification&utm_campaign=cityofcolumbus&x_ns_sku_id=87997840130746&gad_campaignid=21075393992&gbraid=0AAAAo4mICF4hxE_DoU0PFAMy32",
  updateUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof DecisionUpdateNotificationEmail>[0];

export default DecisionUpdateNotificationEmail;
