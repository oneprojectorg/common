import { OP_EMAIL_HELP } from '@op/core';
import { Text } from 'react-email';

import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';
import { InlineLink } from '../components/InlineLink';
import { OtpCode } from '../components/OtpCode';

interface OPEmailChangeCodeEmailProps {
  /** Preview only. GoTrue fills `{{ .Token }}` itself when this is absent. */
  token?: string;
}

/**
 * The `email_change` auth email: an anonymous visitor attaching an email to
 * claim their account. Sent by the Send Email hook. Also the source of
 * `supabase/templates/email_change.html` for the configs without a hook; the
 * snapshot test keeps the two in sync and `pnpm w:emails test -- -u`
 * regenerates the HTML.
 */
export const OPEmailChangeCodeEmail = ({
  token,
}: OPEmailChangeCodeEmailProps = {}) => {
  return (
    <EmailTemplate previewText="Confirm your email! 👋">
      <Header>Confirm your email</Header>
      <Text className="mt-8 text-lg">
        Your confirmation code is ready below. Enter it in your open browser
        window to finish creating your profile.
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

OPEmailChangeCodeEmail.subject = 'Confirm your email';

OPEmailChangeCodeEmail.PreviewProps = {
  token: '2138295687',
} satisfies OPEmailChangeCodeEmailProps;

export default OPEmailChangeCodeEmail;
