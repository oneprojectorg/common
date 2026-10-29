import type { AuthEmailSend } from './handleAuthEmailHook';

/** Renders and sends one auth email through the shared mailer. */
export const sendAuthEmail = async ({
  to,
  kind,
  token,
}: AuthEmailSend): Promise<void> => {
  // Dynamic import keeps the react-email bundle out of callers that never send.
  const emails = await import('@op/emails');
  const Email = {
    signup: emails.OPSignupCodeEmail,
    login: emails.OPLoginCodeEmail,
    emailChange: emails.OPEmailChangeCodeEmail,
  }[kind];

  await emails.OPNodemailer({
    to,
    subject: Email.subject,
    component: () => Email({ token }),
  });
};
