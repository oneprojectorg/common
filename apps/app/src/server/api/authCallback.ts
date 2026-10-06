import { redirectResponse } from '@/server/redirectResponse';
import { createClient } from '@op/api/serverClient';
import { getSafeRedirectPath } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { logger } from '@op/logging';
import { createSBServerClient } from '@op/supabase/server';

/**
 * The callback from OAuth providers: exchanges the code for a session, then
 * lands the user.
 */
export const handleAuthCallback = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // On successful verification, always redirect the user to the app
  const useUrl = OPURLConfig('APP');

  // Errors are surfaced by LoginPanel via the `?error=` query param. Sending
  // them to the bare origin landed unauthed users on a page with no error UI.
  const errorRedirect = new URL('/login', request.url).toString();

  if (code) {
    const supabase = await createSBServerClient();

    const { data: authData, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logger.error('OAuth code exchange failed', { error });

      // return the user to an error page with some instructions
      return redirectResponse(
        `${errorRedirect}?error=${error.message || 'There was an error signing you in.'}`,
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
          return redirectResponse(`${errorRedirect}?error=${error.message}`);
        }

        return redirectResponse(
          `${errorRedirect}?error=${'Unable to verify your email address. Please try again.'}`,
        );
      }
    } else {
      await supabase.auth.signOut();

      return redirectResponse(
        `${errorRedirect}?error=${'Unable to verify your email address. Please try again.'}`,
      );
    }
  }

  const redirectPath = getSafeRedirectPath(searchParams.get('redirect'));

  if (redirectPath !== null) {
    return redirectResponse(new URL(redirectPath, useUrl.ENV_URL));
  }

  return redirectResponse(useUrl.ENV_URL);
};
