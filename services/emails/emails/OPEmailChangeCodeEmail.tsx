import { Text } from 'react-email';

import EmailTemplate from '../components/EmailTemplate';
import { Header } from '../components/Header';
import { OtpCode } from '../components/OtpCode';
import { OtpFootnote } from '../components/OtpFootnote';

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
 *
 * The copy assumes the claim flow. A signed-in user changing an existing
 * email gets this same email at both addresses, so that flow needs its own
 * copy before the app offers it.
 */
export const OPEmailChangeCodeEmail = ({
  token,
}: OPEmailChangeCodeEmailProps = {}) => {
  return (
    <EmailTemplate previewText="Your Common confirmation code">
      <Header>Confirm your email</Header>
      <Text className="mt-8 text-lg">
        Your confirmation code is ready below. Enter it in your open browser
        window to finish creating your profile.
      </Text>

      <OtpCode token={token} />

      <OtpFootnote />
    </EmailTemplate>
  );
};

OPEmailChangeCodeEmail.subject = 'Confirm your email';

OPEmailChangeCodeEmail.PreviewProps = {
  token: '2138295687',
} satisfies OPEmailChangeCodeEmailProps;

export default OPEmailChangeCodeEmail;
