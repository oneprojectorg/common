import { router } from '../trpcFactory';
import accountRouter from './account';
import { contentRouter } from './content';
import { customFormsRouter } from './customForms';
import { decisionRouter } from './decision';
import individualRouter from './individual';
import { moderationRouter } from './moderation';
import { organizationRouter } from './organization';
import { platformRouter } from './platform';
import { postsRouter } from './posts';
import profileRouter from './profile';
import { resourcesRouter } from './resources';
import { taxonomyRouter } from './taxonomy';
import { translationRouter } from './translation';

export const appRouter = router({
  account: accountRouter,
  organization: organizationRouter,
  individual: individualRouter,
  profile: profileRouter,
  taxonomy: taxonomyRouter,
  content: contentRouter,
  posts: postsRouter,
  customForm: customFormsRouter,
  decision: decisionRouter,
  moderation: moderationRouter,
  platform: platformRouter,
  resources: resourcesRouter,
  translation: translationRouter,
});

export type AppRouter = typeof appRouter;

export type { SurveyInternalData } from './decision';
