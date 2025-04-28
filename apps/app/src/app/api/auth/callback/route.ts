/*
 * This route is used to handle the callback from OAuth providers.
 */
import { OPURLConfig } from '@op/core';
import { createSBServerClient } from '@op/supabase/server';
import { trpcVanilla } from '@op/trpc/vanilla';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createUserByEmail } from '../../../../../../../packages/common/src';

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // On successful verification, always redirect the user to the app
  const useUrl = OPURLConfig('APP');

  const errorRedirect = request.nextUrl.clone().origin;

  if (code) {
    const supabase = await createSBServerClient();

    const { data: authData, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error(error);

      // return the user to an error page with some instructions
      return NextResponse.redirect(
        `${errorRedirect}?error=${error.message || 'There was an error signing you in.'}`,
      );
    }

    if (authData.user?.email) {
      // Check if the user is allowed to login
      try {
        await trpcVanilla.account.login.query({
          email: authData.user.email,
          usingOAuth: true,
        });

        // Create service user if there doesn't currently exist one
        if (authData.user.email) {
          await createUserByEmail({
            authUserId: authData.user.id,
            email: authData.user.email,
          });
        }
      } catch (error) {
        // If the user is not invited or not registered, sign them out
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

  return NextResponse.redirect(useUrl.ENV_URL);
};
