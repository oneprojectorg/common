import { OP_EMAIL_HELP } from '@op/core';
import { Button, Heading, Link, Section, Text } from '@react-email/components';
import * as React from 'react';

import EmailTemplate from '../components/EmailTemplate';

interface OPInvitationEmailProps {
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
}

const OPInvitationEmail = ({
  inviterName = 'A team member',
  organizationName = 'Common',
  inviteUrl = 'https://common.oneproject.org/signup',
}: OPInvitationEmailProps) => {
  return (
    <EmailTemplate
      previewText={`${inviterName} invited you to join ${organizationName} on Common! 🎉`}
    >
      <Heading className="!my-0 mx-0 p-0 text-left text-4xl font-normal leading-[48px]">
        You're invited to join {organizationName}!
      </Heading>
      <Text className="mt-4 text-lg">
        <strong>{inviterName}</strong> has invited you to collaborate with{' '}
        <strong>{organizationName}</strong> on Common, the platform for
        connecting organizations and amplifying social impact.
      </Text>

      <Section className="mb-6 mt-10 text-center">
        <Button
          href={inviteUrl}
          className="rounded-lg bg-[#0396A6] px-8 py-4 text-lg font-semibold text-white no-underline hover:bg-[#0396A6]/90"
          style={{
            backgroundColor: '#0396A6',
            borderRadius: '8px',
            color: '#ffffff',
            display: 'inline-block',
            fontSize: '18px',
            fontWeight: '600',
            lineHeight: '1.5',
            padding: '16px 32px',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          Accept Invitation & Join Common
        </Button>
      </Section>

      <Text className="mt-6 text-base">
        Common is a platform where organizations can:
      </Text>
      <Text className="ml-4 text-base">
        • Connect and collaborate with like-minded organizations
        <br />
        • Share resources and opportunities
        <br />
        • Amplify social impact through collective action
        <br />• Build meaningful partnerships for positive change
      </Text>

      <Text className="mt-6 text-base">
        Click the button above to create your account and join{' '}
        <strong>{organizationName}</strong> in making a difference.
      </Text>

      <Text className="mt-8 text-center text-sm text-neutral-500">
        This invitation is valid for 30 days. <br />
        If you're having problems or have questions, send us an{' '}
        <Link href={`mailto:${OP_EMAIL_HELP}`} className="text-[#0396A6]/60">
          email
        </Link>
        .
      </Text>
    </EmailTemplate>
  );
};

OPInvitationEmail.subject = "You're invited to join Common!";

export default OPInvitationEmail;
