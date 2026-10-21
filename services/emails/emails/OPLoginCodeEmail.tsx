import { OP_EMAIL_HELP } from '@op/core';
import { Section, Text } from 'react-email';

import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';
import { InlineLink } from '../components/InlineLink';

/**
 * Source of `supabase/templates/magiclink.html`. GoTrue substitutes
 * `{{ .Token }}` at send time, so the placeholder is rendered verbatim.
 * `OPLoginCodeEmail.test.ts` keeps the two in sync; `pnpm w:emails test -- -u` regenerates the HTML.
 */
export const OPLoginCodeEmail = () => {
  return (
    <EmailTemplate previewText="Your Common login code">
      <Header>Login</Header>
      <Text className="mt-8 text-lg">
        Your login code is ready below. Enter it in your open browser window,
        and we’ll get you signed in.
      </Text>

      <Section className="mt-6 mb-6">
        <Text className="bg-primary-teal m-0 block rounded-lg px-4 py-3 text-center font-mono text-xl font-medium tracking-[0.25em] whitespace-nowrap text-white md:text-2xl">
          {'{{ .Token }}'}
        </Text>
      </Section>

      <Footnote>
        This code will only be valid for the next 10 minutes. If you’re having
        problems, send us an{' '}
        <InlineLink href={`mailto:${OP_EMAIL_HELP}`}>email</InlineLink>.
      </Footnote>
    </EmailTemplate>
  );
};

OPLoginCodeEmail.subject = 'Your Common login code';

export default OPLoginCodeEmail;
