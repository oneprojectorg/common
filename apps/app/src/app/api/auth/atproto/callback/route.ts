import {
  getSessionByState,
  deleteSession,
  exchangeCodeForTokens,
  fetchUserProfile,
  fetchPdsUrl,
  getAuthorizationServerUrl,
  createIdentity,
  getIdentityByEmail,
  createPartialSession,
  createUserByEmail,
} from '@op/common';
import { trpcVanilla } from '@op/api/vanilla';
import { OPURLConfig } from '@op/core';
import { createSBServerClient } from '@op/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const appUrl = OPURLConfig('APP').ENV_URL;
  const errorRedirect = `${appUrl}?error=`;

  if (!code || !state) {
    return NextResponse.redirect(`${errorRedirect}Missing authorization code or state`);
  }

  try {
    const session = await getSessionByState(state);

    if (!session) {
      return NextResponse.redirect(`${errorRedirect}Invalid or expired session`);
    }

    const pdsUrl = await fetchPdsUrl(session.did || '');
    const authServerUrl = await getAuthorizationServerUrl(pdsUrl);
    const tokenEndpoint = `${authServerUrl}/oauth/token`;
    const clientId = `${appUrl}/api/atproto/client-metadata.json`;

    const tokens = await exchangeCodeForTokens({
      code,
      codeVerifier: session.codeVerifier,
      redirectUri: session.redirectUri,
      tokenEndpoint,
      clientId,
    });

    const profile = await fetchUserProfile({
      accessToken: tokens.accessToken,
      pdsUrl,
    });

    if (!profile.email) {
      const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);
      const sessionExpiry = new Date(Date.now() + 30 * 60 * 1000);

      const partialSession = await createPartialSession({
        did: profile.did,
        handle: profile.handle,
        displayName: profile.displayName,
        avatarUrl: profile.avatar,
        bio: profile.description,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry,
        expiresAt: sessionExpiry,
      });

      await deleteSession(state);

      if (!partialSession) {
        throw new Error('Failed to create partial session');
      }

      return NextResponse.redirect(
        `${appUrl}?requireEmail=true&partialSessionId=${partialSession.id}`
      );
    }

    try {
      await trpcVanilla.account.login.query({
        email: profile.email,
        usingOAuth: true,
      });
    } catch (error) {
      await deleteSession(state);

      if (error instanceof Error) {
        return NextResponse.redirect(`${errorRedirect}${encodeURIComponent(error.message)}`);
      }

      return NextResponse.redirect(`${errorRedirect}Not authorized to access this platform`);
    }

    const existingIdentity = await getIdentityByEmail(profile.email);

    let userId: string;

    if (existingIdentity) {
      userId = existingIdentity.userId;
    } else {
      const supabase = await createSBServerClient();
      const { data: authData } = await supabase.auth.signInAnonymously();

      if (!authData.user) {
        throw new Error('Failed to create auth user');
      }

      await createUserByEmail({
        authUserId: authData.user.id,
        email: profile.email,
      });

      userId = authData.user.id;
    }

    const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);

    await createIdentity({
      userId,
      did: profile.did,
      handle: profile.handle,
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatar,
      bio: profile.description,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiry,
    });

    await deleteSession(state);

    return NextResponse.redirect(appUrl);
  } catch (error) {
    console.error('Callback error:', error);

    if (error instanceof Error) {
      return NextResponse.redirect(`${errorRedirect}${encodeURIComponent(error.message)}`);
    }

    return NextResponse.redirect(`${errorRedirect}Authentication failed`);
  }
}
