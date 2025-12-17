import { mergeRouters } from '../../../trpcFactory';
import { createJoinRequestRouter } from './createJoinRequest';
import { getJoinRequestRouter } from './getJoinRequest';
import { listJoinRequestsRouter } from './listJoinRequests';
import { updateJoinRequestRouter } from './updateJoinRequest';

const requestsRouter = mergeRouters(
  createJoinRequestRouter,
  getJoinRequestRouter,
  listJoinRequestsRouter,
  updateJoinRequestRouter,
);

export default requestsRouter;
