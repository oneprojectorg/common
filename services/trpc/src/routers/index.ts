import { router } from '../trpcFactory';

import accountRouter from './account';
import llmRouter from './llm';
import { organizationRouter } from './organization';

export const appRouter = router({
  account: accountRouter,
  organization: organizationRouter,
  llm: llmRouter,
});

export type AppRouter = typeof appRouter;
