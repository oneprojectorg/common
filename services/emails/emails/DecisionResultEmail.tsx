import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

/**
 * The body is admin-authored with its placeholders already resolved, so it is
 * rendered as a text child for react-email to escape. Never as markup.
 */
export const DecisionResultEmail = ({
  processTitle,
  message,
  proposalUrl = 'https://common.oneproject.org/',
  isSelected,
}: {
  processTitle: string;
  message: string;
  proposalUrl: string;
  isSelected: boolean;
}) => {
  return (
    <EmailTemplate
      previewText={
        isSelected
          ? `Your proposal was selected for funding in ${processTitle}`
          : `Results are in for ${processTitle}`
      }
    >
      <Header>
        {isSelected
          ? 'Your proposal was selected for funding.'
          : 'The results are in.'}
      </Header>

      <Text className="my-8 text-lg whitespace-pre-line">{message}</Text>

      <CtaButton href={proposalUrl}>View proposal</CtaButton>

      <Footnote>
        You're receiving this because you submitted a proposal to {processTitle}
        .
      </Footnote>
    </EmailTemplate>
  );
};

DecisionResultEmail.subject = (processTitle: string, isSelected: boolean) =>
  isSelected
    ? `Your proposal was selected — ${processTitle}`
    : `${processTitle} results are in`;

DecisionResultEmail.PreviewProps = {
  processTitle: 'Participatory Budgeting 2026',
  message:
    'Hi Ada,\n\nGreat news — your proposal "Community Garden Revamp" has been selected for funding based on community voting results!\n\nWe\'ll follow up with next steps shortly.',
  proposalUrl: 'https://common.oneproject.org/',
  isSelected: true,
} satisfies Parameters<typeof DecisionResultEmail>[0];

export default DecisionResultEmail;
