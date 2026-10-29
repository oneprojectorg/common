import { OP_EMAIL_HELP } from '@op/core';

import { Footnote } from './Footnote';
import { InlineLink } from './InlineLink';

/** The validity the copy states; GoTrue's `otp_expiry` is the real limit. */
export const OTP_VALID_MINUTES = 10;

/** The footnote under every one-time code: how long it lasts and where to get help. */
export const OtpFootnote = () => (
  <Footnote>
    This code will only be valid for the next {OTP_VALID_MINUTES} minutes. If
    you’re having problems, send us an{' '}
    <InlineLink href={`mailto:${OP_EMAIL_HELP}`}>email</InlineLink>.
  </Footnote>
);
