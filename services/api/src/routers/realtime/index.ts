import { mergeRouters } from '../../trpcFactory';
import { getToken } from './getToken';

export const realtimeRouter = mergeRouters(getToken);
