import { router } from '../trpcFactory';
import accountRouter from './account';
import { commentsRouter } from './comments';
import { contentRouter } from './content';
import { decisionRouter } from './decision';
import individualRouter from './individual';
import llmRouter from './llm';
import { organizationRouter } from './organization';
import { platformRouter } from './platform';
import { postsRouter } from './posts';
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
  comments: commentsRouter,
  posts: postsRouter,
  decision: decisionRouter,
  platform: platformRouter,
});

export type AppRouter = typeof appRouter;
