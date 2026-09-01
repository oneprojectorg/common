import { RejectionReason } from '@op/core/decisions';
import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';
import { InlineLink } from '../components/InlineLink';
import { QuotedNote } from '../components/QuotedNote';

/**
 * Emails are English-only, so the reader-facing copy lives here rather than in
 * the dictionaries. `satisfies` is what makes a new reason fail to compile
 * until it has one.
 */
const reasonLabels = {
  [RejectionReason.INELIGIBLE]: 'Ineligible',
  [RejectionReason.DUPLICATE]: 'Duplicate',
  [RejectionReason.OFF_TOPIC]: 'Off-topic',
  [RejectionReason.INFEASIBLE]: 'Infeasible',
} as const satisfies Record<RejectionReason, string>;

export const ProposalRejectedEmail = ({
  proposalName,
  processTitle,
  proposalUrl = 'https://common.oneproject.org/',
  reason,
  note,
}: {
  proposalName: string;
  processTitle: string;
  proposalUrl: string;
  reason: RejectionReason;
  /** The admin's note to the author. Absent when they wrote none. */
  note?: string;
}) => {
  return (
    <EmailTemplate
      previewText={`Your proposal "${proposalName}" was not advanced`}
    >
      <Header>Proposal Not Advanced</Header>
      <Text className="my-8 text-lg">
        Your proposal <InlineLink href={proposalUrl}>{proposalName}</InlineLink>{' '}
        was not advanced in <strong>{processTitle}</strong>. Reason:{' '}
        <strong>{reasonLabels[reason]}</strong>.
      </Text>

      {note ? <QuotedNote>{note}</QuotedNote> : null}

      <CtaButton href={proposalUrl}>View proposal</CtaButton>

      <Footnote>
        You're receiving this because you're an author of this proposal.
      </Footnote>
    </EmailTemplate>
  );
};

ProposalRejectedEmail.subject = (proposalName: string) =>
  `Your proposal "${proposalName}" was not advanced`;

ProposalRejectedEmail.PreviewProps = {
  proposalName: 'Community Garden Revamp',
  processTitle: 'Participatory Budgeting 2026',
  proposalUrl: 'https://common.oneproject.org/',
  reason: RejectionReason.OFF_TOPIC,
  note: 'This one is about transit funding rather than the park budget this round covers. Resubmit it when the mobility process opens in the spring — the site research is solid.',
} satisfies Parameters<typeof ProposalRejectedEmail>[0];

export default ProposalRejectedEmail;
