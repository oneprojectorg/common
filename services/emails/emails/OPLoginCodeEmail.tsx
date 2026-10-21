import { OP_EMAIL_HELP } from '@op/core';
import { Section, Text } from 'react-email';

import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';
import { InlineLink } from '../components/InlineLink';

interface OPLoginCodeEmailProps {
  /** Preview only. GoTrue fills `{{ .Token }}` itself when this is absent. */
  token?: string;
}

// A word joiner halfway through the code stops iOS Mail and Gmail reading ten
// digits as a phone number without breaking word selection; the app's code
// field drops it on paste.
const SPLIT_AT = 5;
const WORD_JOINER = '\u2060';

/**
 * Source of `supabase/templates/magiclink.html`. The snapshot test keeps the
 * two in sync; `pnpm w:emails test -- -u` regenerates the HTML.
 */
export const OPLoginCodeEmail = ({ token }: OPLoginCodeEmailProps = {}) => {
  return (
    <EmailTemplate previewText="Your Common login code">
      <Header>Login</Header>
      <Text className="mt-8 text-lg">
        Your login code is ready below. Enter it in your open browser window,
        and we’ll get you signed in.
      </Text>

      <Section className="mt-6 mb-6">
        <Text className="bg-primary-teal m-0 block rounded-lg px-4 py-3 text-center font-mono text-xl font-medium tracking-[0.25em] whitespace-nowrap text-white md:text-2xl">
          {token ? splitCode(token) : GOTRUE_SPLIT_TOKEN}
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

OPLoginCodeEmail.PreviewProps = {
  token: '2138295687',
} satisfies OPLoginCodeEmailProps;

const splitCode = (code: string): string =>
  code.length > SPLIT_AT
    ? `${code.slice(0, SPLIT_AT)}${WORD_JOINER}${code.slice(SPLIT_AT)}`
    : code;

// Go template equivalent of `splitCode`, guarded so a short token never panics the send.
const GOTRUE_SPLIT_TOKEN = `{{ if gt (len .Token) ${SPLIT_AT} }}{{ slice .Token 0 ${SPLIT_AT} }}${WORD_JOINER}{{ slice .Token ${SPLIT_AT} }}{{ else }}{{ .Token }}{{ end }}`;

export default OPLoginCodeEmail;
