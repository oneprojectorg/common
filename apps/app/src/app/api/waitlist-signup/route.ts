import type { NextRequest } from 'next/server';

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

  try {
    const response = await mailchimpClient.lists.addListMember(
      process.env.MAILCHIMP_AUDIENCE_ID,
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
