import { OPURLConfig } from '@op/core';
import { NextResponse } from 'next/server';

export async function GET() {
  const appUrl = OPURLConfig('APP').ENV_URL;
  const clientId = `${appUrl}/api/atproto/client-metadata.json`;
  const redirectUri = `${appUrl}/api/auth/atproto/callback`;

  const clientName = process.env.ATPROTO_CLIENT_NAME || 'Common';

  const metadata = {
    client_id: clientId,
    client_name: clientName,
    client_uri: appUrl,
    grant_types: ['authorization_code', 'refresh_token'],
    redirect_uris: [redirectUri],
    scope: 'atproto',
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    dpop_bound_access_tokens: true,
  };

  return NextResponse.json(metadata, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
