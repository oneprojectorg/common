import { OP_EMAIL_HELP } from '@op/core';
import { Heading, Link, Section, Text } from '@react-email/components';
import * as React from 'react';

import EmailTemplate from '../components/EmailTemplate';

const OPLoginCodeEmail = () => {
  return (
    <EmailTemplate previewText="Action Required: Your login code for Common">
      <Heading className="mx-0 !my-0 p-0 text-left font-serif text-[28px] font-light tracking-[-0.02625rem] text-[#222D38]">
        Login
      </Heading>
      <Section className="pb-0 font-sans">
        <Text className="pt-8 pb-6 text-sm">
          Your login code is ready below. Enter it in your open browser window,
          and we’ll get you signed in.
        </Text>

        <code className="mt-6 rounded-lg bg-[#F27405] px-4 py-2 font-mono text-2xl text-white">
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

      <Text className="mb-0 text-xs text-neutral-gray4">
        This code will only be valid for the next 10 minutes. If you’re having
        problems, send us an{' '}
        <Link href={`mailto:${OP_EMAIL_HELP}`} className="text-primary-teal">
          email
        </Link>
        .
      </Text>
    </EmailTemplate>
  );
};

OPLoginCodeEmail.subject = 'Your Login Code';

export default OPLoginCodeEmail;
