import { Text } from 'react-email';

import EmailTemplate from '../components/EmailTemplate';
import { Header } from '../components/Header';
import { OtpCode } from '../components/OtpCode';
import { OtpFootnote } from '../components/OtpFootnote';

interface OPLoginCodeEmailProps {
  /** Preview only. GoTrue fills `{{ .Token }}` itself when this is absent. */
  token?: string;
}

/** The `magiclink` auth email; also the source of `supabase/templates/magiclink.html` (see authCodeEmails.test.ts). */
export const OPLoginCodeEmail = ({ token }: OPLoginCodeEmailProps = {}) => {
  return (
    <EmailTemplate previewText="Your Common login code">
      <Header>Login</Header>
      <Text className="mt-8 text-lg">
        Your login code is ready below. Enter it in your open browser window,
        and we’ll get you signed in.
      </Text>

      <OtpCode token={token} />

      <OtpFootnote />
    </EmailTemplate>
  );
};

OPLoginCodeEmail.subject = 'Your Common login code';

OPLoginCodeEmail.PreviewProps = {
  token: '2138295687',
} satisfies OPLoginCodeEmailProps;

export default OPLoginCodeEmail;
