import { createClient } from '@op/api/serverClient';
import { OPURLConfig } from '@op/core';
import { NextResponse } from 'next/server';

export const GET = async (
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ locale: string; slug: string; profileId: string }>;
  },
) => {
  const { locale, slug, profileId } = await params;
  const proposalUrl = `${OPURLConfig('APP').ENV_URL}/${locale}/decisions/${slug}/proposal/${profileId}`;

  try {
    const client = await createClient();
    await client.decision.acceptProposalInvite({ profileId });
  } catch {
    // Redirect to the proposal page and let the natural access error occur
  }

  return NextResponse.redirect(proposalUrl);
};
