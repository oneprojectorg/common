import { mergeRouters } from '../../../trpcFactory';
import { executeTransitionRouter } from './executeTransition';
import { checkTransitionsRouter } from './checkTransitions';

export const transitionsRouter = mergeRouters(
  executeTransitionRouter,
  checkTransitionsRouter
);