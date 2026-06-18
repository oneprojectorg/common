/*
 * This route is used to handle the callback from OAuth providers.
 */
import { createClient } from '@op/api/serverClient';
import { UnauthorizedError, ValidationError } from '@op/common';
import { isSafeRedirectPath } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { logger } from '@op/logging';
import { createSBServerClient } from '@op/supabase/server';
import { TRPCError } from '@trpc/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import type { LoginErrorCode } from '@/lib/auth/loginError';

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

const unwrapCause = (error: unknown): unknown =>
  error instanceof TRPCError ? error.cause : error;

const classifyLoginError = (error: unknown): LoginErrorCode => {
  const cause = unwrapCause(error);
  if (cause instanceof UnauthorizedError) {
    return 'not_invited';
  }
  if (cause instanceof ValidationError) {
    return 'invalid_email';
  }
  return 'unknown';
};

const errorFields = (error: unknown) => ({
  name: error instanceof Error ? error.name : undefined,
  message: error instanceof Error ? error.message : String(error),
});

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectPath = searchParams.get('redirect');

  const useUrl = OPURLConfig('APP');

  if (code) {
    const supabase = await createSBServerClient();

    const { data: authData, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logger.error('[auth/callback] oauth exchange failed', {
        ...errorFields(error),
        code: error.code,
        status: error.status,
      });
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
        const cause = unwrapCause(loginError);
        logger.error('[auth/callback] login query failed', {
          ...errorFields(loginError),
          causeName: cause instanceof Error ? cause.name : undefined,
          causeMessage: cause instanceof Error ? cause.message : undefined,
        });
      }
      // Clear the partial Supabase session so the user isn't left
      // half-authenticated after an allow-list rejection.
      await supabase.auth.signOut();
      return buildErrorRedirect(request, errorCode, redirectPath);
    }
  }

  if (isSafeRedirectPath(redirectPath)) {
    return NextResponse.redirect(new URL(redirectPath, useUrl.ENV_URL));
  }

  return NextResponse.redirect(useUrl.ENV_URL);
};
