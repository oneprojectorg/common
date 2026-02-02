import type { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';

const mailchimpClient = require('@mailchimp/mailchimp_marketing');

mailchimpClient.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_API_SERVER,
});

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { firstName, lastName, email, organizationName } = body;

  if (!email) {
    return Response.json({ error: 'Email is required' }, { status: 400 });
  }

  if (!firstName) {
    return Response.json({ error: 'First name is required' }, { status: 400 });
  }
  if (!lastName) {
    return Response.json({ error: 'Last name is required' }, { status: 400 });
  }
  // Generate hash from email to check if exists in Mailchimp
  // If it exists, we'll update the user using `setListMember`
  // That way, this endpoint doesn't fail if a user signs up twice

  const subscriberHash = createHash('md5')
    .update(email.toLowerCase())
    .digest('hex');

  try {
    // Subscribe user to Mailchimp
    const subscribeUserResponse = await mailchimpClient.lists.setListMember(
      process.env.MAILCHIMP_AUDIENCE_ID,
      subscriberHash,
      {
        email_address: email,
        status: 'subscribed',
        merge_fields: {
          FNAME: firstName,
          LNAME: lastName,
          ORG: organizationName,
        },
        tags: ['Common Waitlist'], // Ensures this lands in the right segment in Mailchimp
      },
    );

    if (subscribeUserResponse.status >= 400) {
      console.error(subscribeUserResponse);
      return Response.json(
        {
          error: `There was an error subscribing to the newsletter.`,
        },
        { status: 400 },
      );
    }

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: (error as Error).message || (error as Error).toString() },
      { status: 500 },
    );
  }
}
