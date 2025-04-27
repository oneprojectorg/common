import { router } from '../trpcFactory';

import accountRouter from './account';
import { externalRouter } from './external';
import llmRouter from './llm';
import { organizationRouter } from './organization';

export const appRouter = router({
  account: accountRouter,
  organization: organizationRouter,
  llm: llmRouter,
  external: externalRouter,
});

export type AppRouter = typeof appRouter;
