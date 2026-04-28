import { mergeRouters } from '../../../trpcFactory';
import { listProcessesRouter } from './listProcesses';

export const processesRouter = mergeRouters(listProcessesRouter);
