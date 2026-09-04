import { RejectionReason } from '@op/core/decisions';
import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Header } from '../components/Header';
import { QuotedNote } from '../components/QuotedNote';

/**
 * Emails are English-only — nothing in the send path carries a recipient locale
 * — so this copy lives here rather than in the app dictionaries. `satisfies` is
 * what makes a new reason fail to compile until it has one.
 */
const reasonSentences = {
  [RejectionReason.INELIGIBLE]:
    'It did not meet the eligibility rules for this process.',
  [RejectionReason.DUPLICATE]:
    'Another proposal already under review covers the same idea.',
  [RejectionReason.OFF_TOPIC]: 'It falls outside what this process covers.',
  [RejectionReason.INFEASIBLE]:
    "The review team found it could not be delivered within the program's budget or timeline.",
} as const satisfies Record<RejectionReason, string>;

export const ProposalRejectedEmail = ({
  proposalName,
  phaseName,
  proposalUrl = 'https://common.oneproject.org/',
  reason,
  note,
}: {
  proposalName: string;
  /** The phase it did not advance to. Absent when none is configured. */
  phaseName?: string;
  proposalUrl: string;
  reason: RejectionReason;
  /** The admin's note to the author. Absent when they wrote none. */
  note?: string;
}) => {
  const outcomeSentence = phaseName
    ? `did not advance to ${phaseName}.`
    : 'did not advance.';

  return (
    <EmailTemplate
      previewText={`Your proposal "${proposalName}" did not advance`}
    >
      <Header>Your proposal did not advance.</Header>
      <Text className="my-8 text-lg">
        Your proposal, <strong>{proposalName}</strong>, {outcomeSentence}
        <br />
        <strong>{reasonSentences[reason]}</strong>
      </Text>

      {note ? (
        <>
          <Text className="mt-8 mb-0 text-lg">
            A note from the review team:
          </Text>
          <QuotedNote>{note}</QuotedNote>
        </>
      ) : null}

      <CtaButton href={proposalUrl}>View proposal</CtaButton>
    </EmailTemplate>
  );
};

ProposalRejectedEmail.subject = () => 'Your proposal did not advance';

ProposalRejectedEmail.PreviewProps = {
  proposalName: 'Community Garden Revamp',
  phaseName: 'Voting',
  proposalUrl: 'https://common.oneproject.org/',
  reason: RejectionReason.OFF_TOPIC,
  note: 'This one is about transit funding rather than the park budget this round covers. Resubmit it when the mobility process opens in the spring — the site research is solid.',
} satisfies Parameters<typeof ProposalRejectedEmail>[0];

export default ProposalRejectedEmail;
