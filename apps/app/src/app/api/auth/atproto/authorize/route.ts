import {
  generateAuthorizationUrl,
  resolveHandleToDid,
  fetchPdsUrl,
  getAuthorizationServerUrl,
  createSession,
} from '@op/common';
import { OPURLConfig } from '@op/core';
import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { handle } = body;

    if (!handle || typeof handle !== 'string') {
      return NextResponse.json(
        { error: 'Handle is required' },
        { status: 400 }
      );
    }

    const normalizedHandle = handle.startsWith('@')
      ? handle.slice(1)
      : handle;

    if (
      !normalizedHandle ||
      !normalizedHandle.includes('.') ||
      normalizedHandle.length < 3
    ) {
      return NextResponse.json(
        { error: 'Invalid handle format' },
        { status: 400 }
      );
    }

    const did = await resolveHandleToDid(normalizedHandle);

    const pdsUrl = await fetchPdsUrl(did);

    const authServerUrl = await getAuthorizationServerUrl(pdsUrl);

    const state = randomBytes(32).toString('hex');
    const appUrl = OPURLConfig('APP').ENV_URL;
    const clientId = `${appUrl}/api/atproto/client-metadata.json`;
    const redirectUri = `${appUrl}/api/auth/atproto/callback`;

    const { authorizationUrl, codeVerifier } = await generateAuthorizationUrl({
      state,
      handle: normalizedHandle,
      authorizationServerUrl: authServerUrl,
      clientId,
      redirectUri,
    });

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await createSession({
      state,
      codeVerifier,
      handle: normalizedHandle,
      did,
      redirectUri,
      dpopKeyPair: JSON.stringify({}),
      expiresAt,
    });

    return NextResponse.json({
      authorizationUrl,
      state,
    });
  } catch (error) {
    console.error('Authorization error:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('unreachable')) {
        return NextResponse.json(
          { error: 'Bluesky handle not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to initiate authorization' },
      { status: 500 }
    );
  }
}
