import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

export const RevisionRequestedConfirmationEmail = ({
  proposalName,
  processTitle,
  reviewUrl = 'https://common.oneproject.org/',
}: {
  proposalName: string;
  processTitle: string;
  reviewUrl: string;
}) => {
  return (
    <EmailTemplate previewText={`You requested changes to "${proposalName}"`}>
      <Header>Revision Requested</Header>
      <Text className="my-8 text-lg">
        You requested changes to <strong>{proposalName}</strong> in{' '}
        <strong>{processTitle}</strong>. The author has been notified, and
        you'll receive another email when they resubmit their revision.
      </Text>

      <CtaButton href={reviewUrl}>View your review</CtaButton>

      <Footnote>
        You're receiving this because you requested changes to this proposal.
      </Footnote>
    </EmailTemplate>
  );
};

RevisionRequestedConfirmationEmail.subject = (proposalName: string) =>
  `You requested changes to "${proposalName}"`;

RevisionRequestedConfirmationEmail.PreviewProps = {
  proposalName: 'Community Garden Revamp',
  processTitle: 'Participatory Budgeting 2026',
  reviewUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof RevisionRequestedConfirmationEmail>[0];

export default RevisionRequestedConfirmationEmail;
