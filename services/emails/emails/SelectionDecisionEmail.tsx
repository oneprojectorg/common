import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

export const SelectionDecisionEmail = ({
  proposalName,
  processTitle,
  selected,
  proposalUrl = 'https://common.oneproject.org/',
}: {
  proposalName: string;
  processTitle: string;
  selected: boolean;
  proposalUrl: string;
}) => {
  return (
    <EmailTemplate
      previewText={
        selected
          ? `"${proposalName}" was selected in ${processTitle}.`
          : `An update on "${proposalName}" in ${processTitle}.`
      }
    >
      <Header>{selected ? 'Congratulations!' : 'Selection Results'}</Header>
      {selected ? (
        <Text className="my-8 text-lg">
          Your proposal <strong>{proposalName}</strong> was selected in{' '}
          <strong>{processTitle}</strong>.
        </Text>
      ) : (
        <Text className="my-8 text-lg">
          Selections have been made in <strong>{processTitle}</strong>, and your
          proposal <strong>{proposalName}</strong> was not selected this time.
          Thank you for participating — your contribution helped shape the
          process.
        </Text>
      )}

      <CtaButton href={proposalUrl}>View proposal</CtaButton>

      <Footnote>
        You're receiving this because you're an author of this proposal.
      </Footnote>
    </EmailTemplate>
  );
};

SelectionDecisionEmail.subject = (processTitle: string, selected: boolean) =>
  selected
    ? `Your proposal was selected in ${processTitle}`
    : `Selection results for ${processTitle}`;

SelectionDecisionEmail.PreviewProps = {
  proposalName: 'Community Garden Revamp',
  processTitle: 'Participatory Budgeting 2026',
  selected: true,
  proposalUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof SelectionDecisionEmail>[0];

export default SelectionDecisionEmail;
