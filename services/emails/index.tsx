import { APP_NAME, genericEmail } from '@op/core';
import nodemailer from 'nodemailer';
import { render } from 'react-email';
import { Resend } from 'resend';
import z from 'zod';

type RenderParameter = Parameters<typeof render>;

export interface BatchEmailItem {
  to: string;
  subject: string;
  from?: string;
  component: () => React.JSX.Element;
}

// Reject CR/LF before passing addresses to nodemailer/Resend — prevents
// SMTP header injection (extra Bcc:, Subject:, etc.) since z.string().email()
// alone does not strip control chars from every accepted shape.
const safeEmailSchema = z
  .string()
  .email()
  .refine((value) => !/[\r\n]/.test(value), {
    message: 'Email must not contain CR or LF characters',
  });

// Module-scope, pooled transport — without this, every send paid a fresh
// TLS handshake and kept Vercel waitUntil alive through the full SMTP
// round-trip.
const createPooledTransporter = () => {
  const { EMAIL_SMTP_URL, RESEND_PASSWORD } = process.env;

  // Local/self-hosted override: nodemailer accepts a connection URL directly,
  // so a dev inbox (mailpit/inbucket) can stand in for Resend SMTP.
  if (EMAIL_SMTP_URL) {
    return nodemailer.createTransport(EMAIL_SMTP_URL);
  }

  return nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: RESEND_PASSWORD,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
};

let cachedTransporter: ReturnType<typeof createPooledTransporter> | null = null;

const getTransporter = () => {
  if (!cachedTransporter) {
    cachedTransporter = createPooledTransporter();
  }
  return cachedTransporter;
};

/** Renders and sends one email through the configured SMTP transport. */
const sendSmtpEmail = async ({
  to,
  from,
  component,
  subject,
  renderOptions,
}: BatchEmailItem & { renderOptions?: RenderParameter[1] }) => {
  const html = await render(component(), renderOptions);

  return getTransporter().sendMail({
    from: `${from ?? APP_NAME} <${genericEmail}>`,
    to: safeEmailSchema.parse(to),
    subject,
    html,
  });
};

export const OPNodemailer = async ({
  to,
  from,
  component,
  subject,
  renderOptions,
}: {
  to: string;
  from?: string;
  subject: string;
  component: {
    (): React.JSX.Element;
  };
  renderOptions?: RenderParameter[1];
}) => {
  await sendSmtpEmail({ to, from, component, subject, renderOptions });
};

// Initialize Resend client
let resendClient: Resend | null = null;

const getResendClient = () => {
  if (!resendClient) {
    const { RESEND_PASSWORD } = process.env;
    if (!RESEND_PASSWORD) {
      throw new Error('RESEND_PASSWORD environment variable is required');
    }
    resendClient = new Resend(RESEND_PASSWORD);
  }
  return resendClient;
};

export const OPBatchSend = async (emails: BatchEmailItem[]) => {
  if (emails.length === 0) {
    return { data: [], errors: [] };
  }

  const results: { id: string }[] = [];
  const errors: { email: string; error: any }[] = [];

  if (process.env.EMAIL_SMTP_URL) {
    for (const email of emails) {
      try {
        const info = await sendSmtpEmail(email);
        results.push({ id: info.messageId });
      } catch (error) {
        errors.push({ email: email.to, error });
      }
    }

    return { data: results, errors };
  }

  const resend = getResendClient();
  const batchSize = 100; // Resend's limit

  // Process emails in chunks of 100
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    try {
      const batchPayload = batch.map(({ to, subject, from, component }) => ({
        from: `${from ?? APP_NAME} <${genericEmail}>`,
        to: safeEmailSchema.parse(to),
        subject,
        react: component(),
      }));

      const { data, error } = await resend.batch.send(batchPayload);

      if (error) {
        // If batch fails, mark all emails in this batch as failed
        batch.forEach((email) => {
          errors.push({ email: email.to, error });
        });
      } else {
        // The batch endpoint responds { data: [{ id }, ...] } and the SDK
        // hands that body back as `data`, so the per-email ids sit at
        // data.data — pushing `data` itself would count 100-email chunks,
        // making "N sent" logs lie for any send over one email.
        // https://resend.com/docs/api-reference/emails/send-batch-emails
        results.push(...(data?.data ?? []));
      }
    } catch (error) {
      // If batch fails, mark all emails in this batch as failed
      batch.forEach((email) => {
        errors.push({ email: email.to, error });
      });
    }
  }

  return { data: results, errors };
};

export * from './emails/OPInvitationEmail';
export * from './emails/OPRelationshipRequestEmail';
export * from './emails/CommentNotificationEmail';
export * from './emails/ReactionNotificationEmail';
export * from './emails/ProposalSubmittedEmail';
export * from './emails/PhaseTransitionEmail';
export * from './emails/VoteSubmittedEmail';
export * from './emails/RevisionResubmittedEmail';
export * from './emails/RevisionRequestedEmail';
export * from './emails/DecisionUpdateNotificationEmail';
export * from './emails/ContentFlaggedEmail';
export * from './emails/ProposalMergedEmail';
export * from './emails/ProposalMergedIntoYoursEmail';
export * from './emails/ProposalRejectedEmail';

export { render } from 'react-email';
