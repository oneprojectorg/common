import { Link, Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';
import { QuotedNote } from '../components/QuotedNote';

// Both proposal names are links so the email carries a route to the work that
// was superseded as well as to the one that survived. Styled to keep the weight
// the design gives them rather than the client's default link blue.
const inlineLinkClassName = 'font-bold text-primary-teal underline';

/** Goes to the authors of the proposal that was merged away. */
export const ProposalMergedEmail = ({
  proposalName,
  targetProposalName,
  processTitle,
  proposalUrl = 'https://common.oneproject.org/',
  targetProposalUrl = 'https://common.oneproject.org/',
  note,
}: {
  proposalName: string;
  targetProposalName: string;
  processTitle: string;
  proposalUrl: string;
  targetProposalUrl: string;
  /** The admin's reason for the merge, when they gave one. */
  note?: { body: string; authorName?: string | null } | null;
}) => {
  return (
    <EmailTemplate
      previewText={`Your proposal "${proposalName}" was merged into another`}
    >
      <Header>Proposal Merged</Header>
      <Text className="my-8 text-lg">
        Your proposal{' '}
        <Link href={proposalUrl} className={inlineLinkClassName}>
          {proposalName}
        </Link>{' '}
        was merged into{' '}
        <Link href={targetProposalUrl} className={inlineLinkClassName}>
          {targetProposalName}
        </Link>{' '}
        in <strong>{processTitle}</strong>.
      </Text>

      {note ? (
        <QuotedNote authorName={note.authorName}>{note.body}</QuotedNote>
      ) : null}

      <Text className="my-8 text-lg">
        Open the proposal to see how your work was included.
      </Text>

      <CtaButton href={targetProposalUrl}>View proposal</CtaButton>

      <Footnote>
        You're receiving this because you're an author of this proposal.
      </Footnote>
    </EmailTemplate>
  );
};

ProposalMergedEmail.subject = (proposalName: string) =>
  `Your proposal "${proposalName}" was merged into another`;

ProposalMergedEmail.PreviewProps = {
  proposalName: 'Community Garden Revamp',
  targetProposalName: 'Neighbourhood Green Spaces',
  processTitle: 'Participatory Budgeting 2026',
  proposalUrl: 'https://common.oneproject.org/',
  targetProposalUrl: 'https://common.oneproject.org/',
  note: {
    body: "Both proposals address food access in District 5 and the community's support is strongest when consolidated. Your site research on the Parkview lot is reflected in the combined proposal.",
    authorName: 'Aaron Tanaka',
  },
} satisfies Parameters<typeof ProposalMergedEmail>[0];

export default ProposalMergedEmail;
