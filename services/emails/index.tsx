import { APP_NAME, genericEmail } from '@op/core';
import { render } from '@react-email/render';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import z from 'zod';

type RenderParameter = Parameters<typeof render>;

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
  const safeEmail = z.string().email().parse(to);

  const { RESEND_PASSWORD } = process.env;

  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: RESEND_PASSWORD,
    },
  });

  const htmlString = await render(component(), renderOptions);

  const sendMailOptions = {
    from: `${from ?? APP_NAME} <${genericEmail}>`,
    to: safeEmail,
    subject,
    html: htmlString,
  };

  await transporter.sendMail(sendMailOptions);
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

export interface BatchEmailItem {
  to: string;
  subject: string;
  from?: string;
  component: () => React.JSX.Element;
}

export const OPBatchSend = async (emails: BatchEmailItem[]) => {
  if (emails.length === 0) {
    return { data: [], errors: [] };
  }

  const resend = getResendClient();
  const batchSize = 100; // Resend's limit
  const results: any[] = [];
  const errors: { email: string; error: any }[] = [];

  // Process emails in chunks of 100
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    try {
      const batchPayload = batch.map(({ to, subject, from, component }) => ({
        from: `${from ?? APP_NAME} <${genericEmail}>`,
        to: z.string().email().parse(to),
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
        results.push(...(Array.isArray(data) ? data : data ? [data] : []));
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

export * from './emails/InviteRoleChangedEmail';
export * from './emails/OPInvitationEmail';
export * from './emails/OPRelationshipRequestEmail';
export * from './emails/CommentNotificationEmail';
export * from './emails/ReactionNotificationEmail';
