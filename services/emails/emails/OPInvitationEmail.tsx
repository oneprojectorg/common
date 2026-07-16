import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

interface OPInvitationEmailProps {
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
  message?: string;
}

export const OPInvitationEmail = ({
  inviterName = 'A Common user',
  organizationName,
  inviteUrl = 'https://common.oneproject.org/',
  message,
}: OPInvitationEmailProps) => {
  return (
    <EmailTemplate
      previewText={`${inviterName} invited you to join ${organizationName ? `${organizationName} on ` : ''} Common! 🎉`}
    >
      <Header>Join {organizationName ?? 'Common'}!</Header>
      <Text className="mt-8 text-lg">
        <strong>{inviterName}</strong> invited you to Common.
      </Text>

      {message ? (
        <Text className="whitespace-pre-wrap">
          <em>&ldquo;{message}&rdquo;</em>
        </Text>
      ) : null}
      <CtaButton href={inviteUrl}>Accept invite</CtaButton>

      <Footnote>This invite will expire after 1 week</Footnote>
    </EmailTemplate>
  );
};

OPInvitationEmail.subject = `Action Required: You've been invited to join Common`;

OPInvitationEmail.PreviewProps = {
  inviterName: 'Jordan Rivera',
  organizationName: 'One Project',
  inviteUrl: 'https://common.oneproject.org/',
  message: "We'd love to have you in our decision-making community.",
} satisfies Parameters<typeof OPInvitationEmail>[0];

export default OPInvitationEmail;
