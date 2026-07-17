/*
 * This route is used to handle the callback from OAuth providers.
 */
import { createClient } from '@op/api/serverClient';
import { getSafeRedirectPath } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { logger } from '@op/logging';
import { createSBServerClient } from '@op/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // On successful verification, always redirect the user to the app
  const useUrl = OPURLConfig('APP');

  // Errors are surfaced by LoginPanel via the `?error=` query param. Sending
  // them to the bare origin landed unauthed users on a page with no error UI.
  const errorRedirect = new URL('/login', request.nextUrl.origin).toString();

  if (code) {
    const supabase = await createSBServerClient();

    const { data: authData, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logger.error('OAuth code exchange failed', { error });

      // return the user to an error page with some instructions
      return NextResponse.redirect(
        `${errorRedirect}?error=${encodeURIComponent(error.message || 'There was an error signing you in.')}`,
      );
    }

    if (authData.user?.email) {
      // Check if the user is allowed to login
      // Note: User and profile are automatically created by database trigger
      // when Supabase creates the auth.users record
      try {
        const client = await createClient();
        await client.account.login({
          email: authData.user.email,
          usingOAuth: true,
        });
      } catch (error) {
        // If the user is not invited or not registered, sign them out
        await supabase.auth.signOut();

        if (error instanceof Error) {
          return NextResponse.redirect(
            `${errorRedirect}?error=${encodeURIComponent(error.message)}`,
          );
        }

        return NextResponse.redirect(
          `${errorRedirect}?error=${encodeURIComponent('Unable to verify your email address. Please try again.')}`,
        );
      }
    } else {
      await supabase.auth.signOut();

      return NextResponse.redirect(
        `${errorRedirect}?error=${encodeURIComponent('Unable to verify your email address. Please try again.')}`,
      );
    }
  } else {
    const providerError = searchParams.get('error');

    // The IdP declined the sign-in (user cancelled, consent denied, provider
    // misconfigured): GoTrue redirects here with error params and no code.
    // Without this branch the visitor lands on the walled-garden home,
    // unauthenticated and with no feedback.
    if (providerError) {
      const providerErrorDescription = searchParams.get('error_description');

      logger.warn('OAuth provider returned an error', {
        error: providerError,
        description: providerErrorDescription,
      });

      return NextResponse.redirect(
        `${errorRedirect}?error=${encodeURIComponent(providerErrorDescription || 'There was an error signing you in.')}`,
      );
    }
  }

  const redirectPath = getSafeRedirectPath(searchParams.get('redirect'));

  if (redirectPath !== null) {
    return NextResponse.redirect(new URL(redirectPath, useUrl.ENV_URL));
  }

  return NextResponse.redirect(useUrl.ENV_URL);
};
