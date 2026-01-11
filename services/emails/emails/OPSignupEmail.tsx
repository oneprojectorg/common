import { OP_EMAIL_HELP } from '@op/core';
import { Heading, Link, Section, Text } from '@react-email/components';
import * as React from 'react';

import EmailTemplate from '../components/EmailTemplate';

const OPSignupEmail = () => {
  return (
    <EmailTemplate previewText="Confirm your email! 👋">
      <Heading className="!my-0 mx-0 p-0 text-4xl font-normal text-left leading-[48px]">
        Confirm your email
      </Heading>
      <Text className="mt-4 text-lg">
        Your confirmation code is below - enter it in your open browser window
        and we'll get you signed in.
      </Text>

      <Section className="mb-6 mt-10 text-center">
        <code
          className="rounded-xl border-neutral-800 bg-neutral-600 p-4 px-12 text-2xl font-medium text-neutral-50 md:text-3xl font-mono"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            textAlign: 'right',
          }}
        >
          <span
            style={{
              letterSpacing: '0.25em',
              marginRight: '-0.25em',
              textAlign: 'right',
            }}
          >
            {'{{ .Token }}'}
          </span>
        </code>
      </Section>

      <Text className="mt-8 text-neutral-500 text-center text-sm">
        This code will only be valid for the next 10 minutes. <br /> If you’re
        having problems, send us an{' '}
        <Link href={`mailto:${OP_EMAIL_HELP}`} className="text-primary-teal/60">
          email
        </Link>
        .
      </Text>
    </EmailTemplate>
  );
};

OPSignupEmail.subject = 'Confirm your email';

export default OPSignupEmail;
