import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';

import EmailTemplate from '../components/EmailTemplate';
import { Header } from '../components/Header';

interface OPInvitationEmailProps {
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
}

export const OPInvitationEmail = ({
  inviterName = 'A team member',
  organizationName = 'Common',
  inviteUrl = 'https://common.oneproject.org/',
}: OPInvitationEmailProps) => {
  return (
    <EmailTemplate
      previewText={`${inviterName} invited you to join ${organizationName} on Common! 🎉`}
    >
      <Header className="!my-0 mx-0 mt-2 p-0 text-left font-serif text-[28px] font-light tracking-[-0.02625rem] text-[#222D38]">
        Join {organizationName}!
      </Header>
      <Text className="my-8 text-lg">
        <strong>{inviterName}</strong> invited you to Common.
      </Text>

      <Section className="pb-0">
        <Button
          href={inviteUrl}
          className="rounded-lg bg-[#0396A6] px-4 py-3 text-white no-underline hover:bg-[#0396A6]/90"
          style={{
            fontSize: '0.875rem',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          Accept invite
        </Button>
      </Section>

      <Text className="mb-0 text-xs text-[#606A6C]">
        This invite will expire after 1 week
      </Text>
    </EmailTemplate>
  );
};

OPInvitationEmail.subject = `Action Required: You've been invited to join Common`;

export default OPInvitationEmail;
