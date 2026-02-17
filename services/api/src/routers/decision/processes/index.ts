import { mergeRouters } from '../../../trpcFactory';
import { createProcessRouter } from './createProcess';
import { generateProcessRouter } from './generateProcess';
import { getProcessRouter } from './getProcess';
import { listProcessesRouter } from './listProcesses';

export const processesRouter = mergeRouters(
  createProcessRouter,
  generateProcessRouter,
  getProcessRouter,
  listProcessesRouter,
);
