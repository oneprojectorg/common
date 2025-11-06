import { mergeRouters } from '../../../trpcFactory';
import { listAllUsersRouter } from './listAllUsers';

export const platformAdminRouter = mergeRouters(listAllUsersRouter);
