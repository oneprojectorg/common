import type { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';

const mailchimpClient = require('@mailchimp/mailchimp_marketing');

mailchimpClient.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_API_SERVER,
});

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { email } = body;

  if (!email) {
    return Response.json({ error: 'Email is required' }, { status: 400 });
  }

  // Generate hash from email to check if exists in Mailchimp
  const subscriberHash = createHash('md5')
    .update(email.toLowerCase())
    .digest('hex');

  try {
    const response = await mailchimpClient.lists.setListMember(
      process.env.MAILCHIMP_AUDIENCE_ID,
      subscriberHash,
      {
        email_address: email,
        status: 'subscribed',
        tags: ['waitlist'],
      },
    );

    if (response.status >= 400) {
      return Response.json(
        {
          error: `There was an error subscribing to the newsletter.`,
        },
        { status: 400 },
      );
    }

    return Response.json({ error: '' }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message || (error as Error).toString() },
      { status: 500 },
    );
  }
}
