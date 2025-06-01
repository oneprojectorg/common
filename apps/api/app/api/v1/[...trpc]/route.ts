import { appRouter, createContext } from '@op/api';
import { API_OPENAPI_PATH } from '@op/core';
import { withAxiom } from '@op/logger';
import { createSBServerClient } from '@op/supabase/server';
import { createOpenApiFetchHandler } from 'trpc-to-openapi';

import { verifyAdminOnly } from '../../../route';

const handler = withAxiom(async (req: Request) => {
  const supabase = await createSBServerClient();
  const data = await supabase.auth.getUser();

  verifyAdminOnly(data);

  // Handle incoming OpenAPI requests
  return createOpenApiFetchHandler({
    endpoint: `/${API_OPENAPI_PATH}`,
    router: appRouter,
    createContext,
    req,
  });
});

export {
  handler as DELETE,
  handler as GET,
  handler as HEAD,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
