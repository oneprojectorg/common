import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

/**
 * The outcome an author gets when a decision publishes its results. The body is
 * written by the process admin in the Compose Notifications modal, with its
 * placeholders already resolved — rendered as a text child, so react-email
 * escapes it. Never as markup.
 */
export const DecisionResultEmail = ({
  processTitle,
  message,
  proposalUrl = 'https://common.oneproject.org/',
  isFunded,
}: {
  processTitle: string;
  message: string;
  proposalUrl: string;
  isFunded: boolean;
}) => {
  return (
    <EmailTemplate
      previewText={
        isFunded
          ? `Your proposal was selected for funding in ${processTitle}`
          : `Results are in for ${processTitle}`
      }
    >
      <Header>
        {isFunded
          ? 'Your proposal was selected for funding.'
          : 'The results are in.'}
      </Header>

      {/* The message comes from a textarea; keep its paragraph breaks. */}
      <Text className="my-8 text-lg whitespace-pre-line">{message}</Text>

      <CtaButton href={proposalUrl}>View proposal</CtaButton>

      <Footnote>
        You're receiving this because you submitted a proposal to {processTitle}
        .
      </Footnote>
    </EmailTemplate>
  );
};

DecisionResultEmail.subject = (processTitle: string, isFunded: boolean) =>
  isFunded
    ? `Your proposal was selected — ${processTitle}`
    : `${processTitle} results are in`;

DecisionResultEmail.PreviewProps = {
  processTitle: 'Participatory Budgeting 2026',
  message:
    'Hi Ada,\n\nGreat news — your proposal "Community Garden Revamp" has been selected for funding! You\'ve been allocated $12,000 based on community voting results.\n\nWe\'ll follow up with next steps on disbursement shortly.',
  proposalUrl: 'https://common.oneproject.org/',
  isFunded: true,
} satisfies Parameters<typeof DecisionResultEmail>[0];

export default DecisionResultEmail;
