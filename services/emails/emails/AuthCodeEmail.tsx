import { genericEmail } from '@op/core';
import { Text } from 'react-email';

import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';
import { InlineLink } from '../components/InlineLink';

export interface AuthCodeEmailCopy {
  previewText: string;
  heading: string;
  description: string;
  codeExpiryHint: string;
  supportHint: string;
  maintainerNote: string;
  deliveryReasonNote: string;
}

export const AuthCodeEmail = ({
  code,
  copy,
  lang,
  dir,
}: {
  code: string;
  copy: AuthCodeEmailCopy;
  lang: string;
  dir: 'ltr' | 'rtl';
}) => (
  <EmailTemplate
    previewText={copy.previewText}
    lang={lang}
    dir={dir}
    maintainerNote={copy.maintainerNote}
    deliveryReasonNote={copy.deliveryReasonNote}
  >
    <Header>{copy.heading}</Header>
    <Text className="mt-8 text-lg">{copy.description}</Text>
    {/* One cell per digit, so mail clients do not detect the code as a phone
        number and turn it into a call link. */}
    <table
      role="presentation"
      dir="ltr"
      align="center"
      className="my-8"
      style={{ borderCollapse: 'separate', borderSpacing: '4px' }}
    >
      <tbody>
        <tr>
          {[...code].map((digit, index) => (
            <td
              key={index}
              data-code-digit
              className="rounded border border-solid border-neutral-200 px-2 py-2 text-center font-mono text-2xl"
            >
              {digit}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
    <Footnote>{copy.codeExpiryHint}</Footnote>
    <Footnote>
      {copy.supportHint}{' '}
      <InlineLink href={`mailto:${genericEmail}`}>{genericEmail}</InlineLink>
    </Footnote>
  </EmailTemplate>
);

AuthCodeEmail.PreviewProps = {
  code: '0123456789',
  lang: 'en',
  dir: 'ltr',
  copy: {
    previewText: 'Time to get you logged in! 🔑',
    heading: 'Log in',
    description:
      'Your login code is below. Enter it in your open browser window and we’ll get you signed in.',
    codeExpiryHint: 'This code will only be valid for the next 10 minutes.',
    supportHint: 'Having problems? Email us at',
    maintainerNote: 'Common is maintained by One Project.',
    deliveryReasonNote:
      'You’re receiving this email as part of our authentication and communication processes.',
  },
} satisfies Parameters<typeof AuthCodeEmail>[0];

export default AuthCodeEmail;
