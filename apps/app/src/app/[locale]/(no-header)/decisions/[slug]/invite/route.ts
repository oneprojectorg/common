import { createClient } from '@op/api/serverClient';
import { OPURLConfig } from '@op/core';
import { NextResponse } from 'next/server';

export const GET = async (
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ locale: string; slug: string }>;
  },
) => {
  const { slug } = await params;
  const decisionUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${slug}`;

  try {
    const client = await createClient();
    await client.decision.acceptDecisionInvite({ slug });
  } catch {
    // Redirect to the decision page and let the natural access error occur
  }

  return NextResponse.redirect(decisionUrl);
};
