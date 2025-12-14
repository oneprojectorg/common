import { mergeRouters } from '../../../trpcFactory';
import { checkTransitionsRouter } from './checkTransitions';
import { executeTransitionRouter } from './executeTransition';

export const transitionsRouter = mergeRouters(
  executeTransitionRouter,
  checkTransitionsRouter,
);
