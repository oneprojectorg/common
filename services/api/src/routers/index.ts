import { router } from '../trpcFactory';
import accountRouter from './account';
import { contentRouter } from './content';
import { decisionRouter } from './decision';
import individualRouter from './individual';
import { organizationRouter } from './organization';
import { platformRouter } from './platform';
import { pollsRouter } from './polls';
import { postsRouter } from './posts';
import profileRouter from './profile';
import { realtimeRouter } from './realtime';
import { taxonomyRouter } from './taxonomy';

export const appRouter = router({
  account: accountRouter,
  organization: organizationRouter,
  individual: individualRouter,
  profile: profileRouter,
  taxonomy: taxonomyRouter,
  content: contentRouter,
  posts: postsRouter,
  polls: pollsRouter,
  decision: decisionRouter,
  platform: platformRouter,
  realtime: realtimeRouter,
});

export type AppRouter = typeof appRouter;
