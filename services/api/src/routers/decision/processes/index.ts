import { mergeRouters } from '../../../trpcFactory';
import { createProcessRouter } from './createProcess';
import { getProcessRouter } from './getProcess';
import { listProcessesRouter } from './listProcesses';

export const processesRouter = mergeRouters(
  createProcessRouter,
  getProcessRouter,
  listProcessesRouter,
);