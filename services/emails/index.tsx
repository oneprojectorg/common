import { APP_NAME, genericEmail } from '@op/core';
import { render } from '@react-email/render';
import nodemailer from 'nodemailer';
import z from 'zod';

type RenderParameter = Parameters<typeof render>;

export const OPNodemailer = async ({
  to,
  component,
  renderOptions,
}: {
  to: string;
  component: {
    (): React.JSX.Element;
    subject: string;
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
    from: `${APP_NAME} <${genericEmail}>`,
    to: safeEmail,
    subject: component.subject,
    html: htmlString,
  };

  await transporter.sendMail(sendMailOptions);
};
