import { ApiReference } from '@scalar/nextjs-api-reference';
import { NextResponse } from 'next/server';

import { adminEmails, APP_NAME, OPURLConfig } from '@op/core';
import { createSBServerClient } from '@op/supabase/server';

import type { UserResponse } from '@op/supabase/lib';

const useUrl = OPURLConfig('APP');

export const verifyAdminOnly = (data: UserResponse) => {
  if (!data) {
    throw new Error(`Failed to authenticate user`);
  }

  if (data.error) {
    throw new Error(`Failed to authenticate user: ${data.error.message}`);
  }

  if (data.data.user.is_anonymous) {
    throw new Error(`Anonymous users are not allowed to access this resource`);
  }

  if (data.data.user.confirmed_at === null) {
    throw new Error(`User has not confirmed their email address`);
  }

  if (adminEmails.includes(data.data.user.email || '')) {
    return data.data.user;
  }

  throw new Error('User is not a super admin');
};

export const GET = async () => {
  const supabase = await createSBServerClient();
  const data = await supabase.auth.getUser();

  try {
    verifyAdminOnly(data);

    const response = ApiReference({
      hideClientButton: true,
      metaData: {
        title: `${APP_NAME} API`,
        description: `API Reference for the ${APP_NAME} API`,
      },
      //   hideDownloadButton: true,
      authentication: undefined,
      defaultOpenAllTags: false,
      isEditable: false,
      layout: 'modern',
      theme: 'kepler',
      spec: {
        url: '/api/v1/openapi.json',
      },
    });

    return await response();
  }
  catch {
    return NextResponse.redirect(new URL('/', useUrl.ENV_URL));
  }
};
