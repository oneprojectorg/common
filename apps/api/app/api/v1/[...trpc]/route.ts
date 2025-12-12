import { appRouter, createContext, handleTRPCRequest } from '@op/api';
import { API_OPENAPI_PATH } from '@op/core';
import { createSBServerClient } from '@op/supabase/server';

import { verifyAdminOnly } from '../../../route';

const handler = async (req: Request) => {
  const supabase = await createSBServerClient();
  const data = await supabase.auth.getUser();

  verifyAdminOnly(data);

  // Handle incoming OpenAPI requests using the same handler as tRPC
  // This ensures consistent channel accumulation behavior
  return handleTRPCRequest({
    endpoint: `/${API_OPENAPI_PATH}`,
    router: appRouter,
    createContext,
    req,
  });
};

export {
  handler as DELETE,
  handler as GET,
  handler as HEAD,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
