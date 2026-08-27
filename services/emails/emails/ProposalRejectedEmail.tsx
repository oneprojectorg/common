import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';
import { InlineLink } from '../components/InlineLink';
import { QuotedNote } from '../components/QuotedNote';

/**
 * Emails are English-only, so `RejectionReason`'s reader-facing copy lives here
 * rather than in the dictionaries. `@op/common` depends on this package, so the
 * enum itself can't be imported without a cycle.
 */
const reasonLabels = {
  ineligible: 'Ineligible',
  duplicate: 'Duplicate',
  'off-topic': 'Off-topic',
  infeasible: 'Infeasible',
} as const;

export type ProposalRejectionReason = keyof typeof reasonLabels;

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
  reason: ProposalRejectionReason;
  /** The admin's note to the author. Absent when they wrote none. */
  note?: string;
}) => {
  return (
    <EmailTemplate previewText={`Your proposal "${proposalName}" was rejected`}>
      <Header>Proposal Rejected</Header>
      <Text className="my-8 text-lg">
        Your proposal <InlineLink href={proposalUrl}>{proposalName}</InlineLink>{' '}
        was rejected in <strong>{processTitle}</strong>. Reason:{' '}
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
  `Your proposal "${proposalName}" was rejected`;

ProposalRejectedEmail.PreviewProps = {
  proposalName: 'Community Garden Revamp',
  processTitle: 'Participatory Budgeting 2026',
  proposalUrl: 'https://common.oneproject.org/',
  reason: 'off-topic',
  note: 'This one is about transit funding rather than the park budget this round covers. Resubmit it when the mobility process opens in the spring — the site research is solid.',
} satisfies Parameters<typeof ProposalRejectedEmail>[0];

export default ProposalRejectedEmail;
