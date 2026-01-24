import { mergeRouters } from '../../trpcFactory';
import { closeRouter } from './close';
import { createPollRouter } from './create';
import { getRouter } from './get';
import { listByTargetRouter } from './listByTarget';
import { voteRouter } from './vote';

export const pollsRouter = mergeRouters(
  createPollRouter,
  voteRouter,
  getRouter,
  closeRouter,
  listByTargetRouter,
);
