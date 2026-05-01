/*
 * This route is used to handle the callback from OAuth providers.
 */
import { createClient } from '@op/api/serverClient';
import { UnauthorizedError, ValidationError } from '@op/common';
import { isSafeRedirectPath } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { createSBServerClient } from '@op/supabase/server';
import { TRPCError } from '@trpc/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type LoginErrorCode =
  | 'not_invited'
  | 'invalid_email'
  | 'oauth_failed'
  | 'no_email'
  | 'unknown';

const buildErrorRedirect = (
  request: NextRequest,
  code: LoginErrorCode,
  redirectPath: string | null,
) => {
  const url = new URL('/login', request.nextUrl.origin);
  url.searchParams.set('error', code);
  if (isSafeRedirectPath(redirectPath)) {
    url.searchParams.set('redirect', redirectPath);
  }
  return NextResponse.redirect(url);
};

const classifyLoginError = (error: unknown): LoginErrorCode => {
  const cause = error instanceof TRPCError ? error.cause : error;
  if (cause instanceof UnauthorizedError) {
    return 'not_invited';
  }
  if (cause instanceof ValidationError) {
    return 'invalid_email';
  }
  return 'unknown';
};

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectPath = searchParams.get('redirect');

  // On successful verification, always redirect the user to the app
  const useUrl = OPURLConfig('APP');

  if (code) {
    const supabase = await createSBServerClient();

    const { data: authData, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error(error);
      return buildErrorRedirect(request, 'oauth_failed', redirectPath);
    }

    if (!authData.user?.email) {
      await supabase.auth.signOut();
      return buildErrorRedirect(request, 'no_email', redirectPath);
    }

    try {
      const client = await createClient();
      await client.account.login({
        email: authData.user.email,
        usingOAuth: true,
      });
    } catch (loginError) {
      const errorCode = classifyLoginError(loginError);
      if (errorCode === 'unknown') {
        console.error('[auth/callback] login query failed', loginError);
      }
      // Login failed for any reason — clear the partial Supabase session
      // before redirecting so the user isn't left half-authenticated.
      await supabase.auth.signOut();
      return buildErrorRedirect(request, errorCode, redirectPath);
    }
  }

  if (isSafeRedirectPath(redirectPath)) {
    return NextResponse.redirect(new URL(redirectPath, useUrl.ENV_URL));
  }

  return NextResponse.redirect(useUrl.ENV_URL);
};
