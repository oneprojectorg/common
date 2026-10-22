import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

type Copy = {
  previewText: (processTitle: string) => string;
  header: string;
  subject: (processTitle: string) => string;
};

const COPY: Record<
  'results' | 'advancement',
  Record<'selected' | 'notSelected', Copy>
> = {
  results: {
    selected: {
      previewText: (processTitle) =>
        `Your proposal was selected in ${processTitle}`,
      header: 'Your proposal was selected.',
      subject: (processTitle) => `Your proposal was selected — ${processTitle}`,
    },
    notSelected: {
      previewText: (processTitle) => `Results are in for ${processTitle}`,
      header: 'The results are in.',
      subject: (processTitle) => `${processTitle} results are in`,
    },
  },
  advancement: {
    selected: {
      previewText: (processTitle) =>
        `Your proposal advanced to the next phase of ${processTitle}`,
      header: 'Your proposal advanced.',
      subject: (processTitle) => `Your proposal advanced — ${processTitle}`,
    },
    notSelected: {
      previewText: (processTitle) =>
        `An update on your proposal in ${processTitle}`,
      header: 'An update on your proposal.',
      subject: (processTitle) => `An update on your proposal — ${processTitle}`,
    },
  },
};

const getCopy = ({
  isSelected,
  publishesResults,
}: {
  isSelected: boolean;
  publishesResults: boolean;
}): Copy =>
  COPY[publishesResults ? 'results' : 'advancement'][
    isSelected ? 'selected' : 'notSelected'
  ];

/**
 * The body is admin-authored with its placeholders already resolved, so it is
 * rendered as a text child for react-email to escape. Never as markup.
 */
export const DecisionResultEmail = ({
  processTitle,
  message,
  proposalUrl = 'https://common.oneproject.org/',
  isSelected,
  publishesResults,
}: {
  processTitle: string;
  message: string;
  proposalUrl: string;
  isSelected: boolean;
  publishesResults: boolean;
}) => {
  const copy = getCopy({ isSelected, publishesResults });

  return (
    <EmailTemplate previewText={copy.previewText(processTitle)}>
      <Header>{copy.header}</Header>

      <Text className="my-8 text-lg whitespace-pre-line">{message}</Text>

      <CtaButton href={proposalUrl}>View proposal</CtaButton>

      <Footnote>
        You're receiving this because you submitted a proposal to {processTitle}
        .
      </Footnote>
    </EmailTemplate>
  );
};

DecisionResultEmail.subject = ({
  processTitle,
  isSelected,
  publishesResults,
}: {
  processTitle: string;
  isSelected: boolean;
  publishesResults: boolean;
}) => getCopy({ isSelected, publishesResults }).subject(processTitle);

DecisionResultEmail.PreviewProps = {
  processTitle: 'Participatory Budgeting 2026',
  message:
    'Hi Ada,\n\nGreat news — your proposal "Community Garden Revamp" has been selected based on voting results!\n\nWe\'ll follow up with next steps shortly.',
  proposalUrl: 'https://common.oneproject.org/',
  isSelected: true,
  publishesResults: true,
} satisfies Parameters<typeof DecisionResultEmail>[0];

export default DecisionResultEmail;
