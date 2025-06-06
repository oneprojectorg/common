import { router } from '../trpcFactory';
import accountRouter from './account';
import { contentRouter } from './content';
import llmRouter from './llm';
import { organizationRouter } from './organization';
import { taxonomyRouter } from './taxonomy';

export const appRouter = router({
  account: accountRouter,
  organization: organizationRouter,
  llm: llmRouter,
  taxonomy: taxonomyRouter,
  content: contentRouter,
});

export type AppRouter = typeof appRouter;
