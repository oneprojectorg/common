import { Button, Section, Text } from 'react-email';

import EmailTemplate from '../components/EmailTemplate';
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
      <Text className="my-8 text-lg">
        <strong>{inviterName}</strong> invited you to Common.
      </Text>

      <Section className="pb-0">
        <Button
          href={inviteUrl}
          className="rounded-lg bg-primary-teal px-4 py-3 text-white no-underline hover:bg-primary-teal/90"
          style={{
            fontSize: '0.875rem',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          Accept invite
        </Button>
        {message ? <Text>{message}</Text> : null}
      </Section>

      <Text className="mb-0 text-sm text-neutral-gray4">
        This invite will expire after 1 week
      </Text>
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
