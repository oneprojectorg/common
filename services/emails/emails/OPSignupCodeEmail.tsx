import { Text } from 'react-email';

import EmailTemplate from '../components/EmailTemplate';
import { Header } from '../components/Header';
import { OtpCode } from '../components/OtpCode';
import { OtpFootnote } from '../components/OtpFootnote';

interface OPSignupCodeEmailProps {
  /** Preview only. GoTrue fills `{{ .Token }}` itself when this is absent. */
  token?: string;
}

/**
 * The `signup` auth email (first sign-in of a new account), sent by the Send
 * Email hook. Also the source of `supabase/templates/confirm.html` for the
 * configs without a hook; the snapshot test keeps the two in sync and
 * `pnpm w:emails test -- -u` regenerates the HTML.
 */
export const OPSignupCodeEmail = ({ token }: OPSignupCodeEmailProps = {}) => {
  return (
    <EmailTemplate previewText="Your Common confirmation code">
      <Header>Confirm your email</Header>
      <Text className="mt-8 text-lg">
        Your confirmation code is ready below. Enter it in your open browser
        window, and we’ll get you signed in.
      </Text>

      <OtpCode token={token} />

      <OtpFootnote />
    </EmailTemplate>
  );
};

OPSignupCodeEmail.subject = 'Confirm your email';

OPSignupCodeEmail.PreviewProps = {
  token: '2138295687',
} satisfies OPSignupCodeEmailProps;

export default OPSignupCodeEmail;
