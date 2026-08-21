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
        `${errorRedirect}?error=${error.message || 'There was an error signing you in.'}`,
      );
    }

    if (authData.user?.email) {
      // Check if the user is allowed to login
      // Note: User and profile are automatically created by database trigger
      // when Supabase creates the auth.users record
      try {
        const client = await createClient();
        const result = await client.account.login({
          email: authData.user.email,
          usingOAuth: true,
        });

        if (!result.ok) {
          // Turned away by the invite gate. The code exchange already minted a
          // session, so drop it. `reason` is machine-readable — LoginPanel owns
          // the localized copy for it, so no English message travels in the URL.
          await supabase.auth.signOut();

          return NextResponse.redirect(
            `${errorRedirect}?reason=${encodeURIComponent(result.reason)}`,
          );
        }
      } catch (error) {
        // The gate itself failed (the invite decision is handled above), so we
        // never established whether this visitor may be here — sign them out.
        await supabase.auth.signOut();

        if (error instanceof Error) {
          return NextResponse.redirect(
            `${errorRedirect}?error=${error.message}`,
          );
        }

        return NextResponse.redirect(
          `${errorRedirect}?error=${'Unable to verify your email address. Please try again.'}`,
        );
      }
    } else {
      await supabase.auth.signOut();

      return NextResponse.redirect(
        `${errorRedirect}?error=${'Unable to verify your email address. Please try again.'}`,
      );
    }
  }

  const redirectPath = getSafeRedirectPath(searchParams.get('redirect'));

  if (redirectPath !== null) {
    return NextResponse.redirect(new URL(redirectPath, useUrl.ENV_URL));
  }

  return NextResponse.redirect(useUrl.ENV_URL);
};
