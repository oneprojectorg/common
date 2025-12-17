import { mergeRouters } from '../../../trpcFactory';
import { createJoinRequestRouter } from './createJoinRequest';
import { deleteJoinRequestRouter } from './deleteJoinRequest';
import { getJoinRequestRouter } from './getJoinRequest';
import { listJoinRequestsRouter } from './listJoinRequests';
import { updateJoinRequestRouter } from './updateJoinRequest';

const requestsRouter = mergeRouters(
  createJoinRequestRouter,
  deleteJoinRequestRouter,
  getJoinRequestRouter,
  listJoinRequestsRouter,
  updateJoinRequestRouter,
);

export default requestsRouter;
