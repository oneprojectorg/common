import { router } from '../trpcFactory';

import accountRouter from './account';
import llmRouter from './llm';

export const appRouter = router({
  account: accountRouter,
  llm: llmRouter,
});

export type AppRouter = typeof appRouter;
