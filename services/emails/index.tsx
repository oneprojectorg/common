import { APP_NAME, genericEmail } from '@op/core';
import { render } from '@react-email/render';
import nodemailer from 'nodemailer';
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
    from: from ?? `${APP_NAME} <${genericEmail}>`,
    to: safeEmail,
    subject,
    html: htmlString,
  };

  await transporter.sendMail(sendMailOptions);
};

export * from './emails/OPInvitationEmail';
