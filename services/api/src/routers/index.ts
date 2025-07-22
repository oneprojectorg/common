import { router } from '../trpcFactory';
import accountRouter from './account';
import { contentRouter } from './content';
import individualRouter from './individual';
import llmRouter from './llm';
import { organizationRouter } from './organization';
import profileRouter from './profile';
import { taxonomyRouter } from './taxonomy';

export const appRouter = router({
  account: accountRouter,
  organization: organizationRouter,
  individual: individualRouter,
  profile: profileRouter,
  llm: llmRouter,
  taxonomy: taxonomyRouter,
  content: contentRouter,
});

export type AppRouter = typeof appRouter;
