import { OP_EMAIL_HELP } from '@op/core';
import { Text } from 'react-email';

import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';
import { InlineLink } from '../components/InlineLink';
import { OtpCode } from '../components/OtpCode';

interface OPLoginCodeEmailProps {
  /** Preview only. GoTrue fills `{{ .Token }}` itself when this is absent. */
  token?: string;
}

/**
 * The `magiclink` auth email, sent by the Send Email hook. Also the source of
 * `supabase/templates/magiclink.html` for the configs without a hook; the
 * snapshot test keeps the two in sync and `pnpm w:emails test -- -u`
 * regenerates the HTML.
 */
export const OPLoginCodeEmail = ({ token }: OPLoginCodeEmailProps = {}) => {
  return (
    <EmailTemplate previewText="Your Common login code">
      <Header>Login</Header>
      <Text className="mt-8 text-lg">
        Your login code is ready below. Enter it in your open browser window,
        and we’ll get you signed in.
      </Text>

      <OtpCode token={token} />

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

export default OPLoginCodeEmail;
