
import { createTRPCClient } from '@trpc/client';

import { links } from './links';

import type { AppRouter } from './routers';

export const trpcVanilla = createTRPCClient<AppRouter>({
  links,
});
