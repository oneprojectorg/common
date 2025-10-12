import {
  getPartialSession,
  deletePartialSession,
  createIdentity,
  getIdentityByEmail,
  createUserByEmail,
} from '@op/common';
import { trpcVanilla } from '@op/api/vanilla';
import { OPURLConfig } from '@op/core';
import { createSBServerClient } from '@op/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { partialSessionId, email } = body;

    if (!partialSessionId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const session = await getPartialSession(partialSessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      );
    }

    const now = new Date();

    if (new Date(session.expiresAt) < now) {
      await deletePartialSession(partialSessionId);
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 404 }
      );
    }

    try {
      await trpcVanilla.account.login.query({
        email,
        usingOAuth: true,
      });
    } catch (error) {
      await deletePartialSession(partialSessionId);

      if (error instanceof Error) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: 'Not authorized to access this platform' },
        { status: 403 }
      );
    }

    const existingIdentity = await getIdentityByEmail(email);

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
        email,
      });

      userId = authData.user.id;
    }

    await createIdentity({
      userId,
      did: session.did,
      handle: session.handle,
      email,
      displayName: session.displayName || undefined,
      avatarUrl: session.avatarUrl || undefined,
      bio: session.bio || undefined,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken || undefined,
      tokenExpiry: new Date(session.tokenExpiry),
    });

    await deletePartialSession(partialSessionId);

    const appUrl = OPURLConfig('APP').ENV_URL;

    return NextResponse.json({
      success: true,
      redirectUrl: appUrl,
    });
  } catch (error) {
    console.error('Complete email error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to complete signup' },
      { status: 500 }
    );
  }
}
