import { Link, Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';
import { QuotedNote } from '../components/QuotedNote';

const inlineLinkClassName = 'font-bold text-primary-teal underline';

/** Goes to the authors of the proposal that survived; nobody receives both. */
export const ProposalMergedIntoYoursEmail = ({
  proposalName,
  sourceProposalName,
  processTitle,
  proposalUrl = 'https://common.oneproject.org/',
  sourceProposalUrl = 'https://common.oneproject.org/',
  note,
}: {
  /** The recipient's own proposal. */
  proposalName: string;
  sourceProposalName: string;
  processTitle: string;
  proposalUrl: string;
  sourceProposalUrl: string;
  /** The admin's reason for the merge. The merge dialog addresses its note
   *  field to this recipient, so it has to reach them here. */
  note?: { body: string; authorName?: string | null } | null;
}) => {
  return (
    <EmailTemplate previewText={`A proposal was merged into "${proposalName}"`}>
      <Header>Proposal Merged</Header>
      <Text className="my-8 text-lg">
        <Link href={sourceProposalUrl} className={inlineLinkClassName}>
          {sourceProposalName}
        </Link>{' '}
        was merged into your proposal{' '}
        <Link href={proposalUrl} className={inlineLinkClassName}>
          {proposalName}
        </Link>{' '}
        in <strong>{processTitle}</strong>. Open your proposal to review what
        was added.
      </Text>

      {note ? (
        <QuotedNote authorName={note.authorName}>{note.body}</QuotedNote>
      ) : null}

      <CtaButton href={proposalUrl}>View proposal</CtaButton>

      <Footnote>
        You're receiving this because you're an author of this proposal.
      </Footnote>
    </EmailTemplate>
  );
};

ProposalMergedIntoYoursEmail.subject = (proposalName: string) =>
  `A proposal was merged into "${proposalName}"`;

ProposalMergedIntoYoursEmail.PreviewProps = {
  proposalName: 'Neighbourhood Green Spaces',
  sourceProposalName: 'Community Garden Revamp',
  processTitle: 'Participatory Budgeting 2026',
  proposalUrl: 'https://common.oneproject.org/',
  sourceProposalUrl: 'https://common.oneproject.org/',
  note: {
    body: "Both proposals address food access in District 5 and the community's support is strongest when consolidated.",
    authorName: 'Aaron Tanaka',
  },
} satisfies Parameters<typeof ProposalMergedIntoYoursEmail>[0];

export default ProposalMergedIntoYoursEmail;
