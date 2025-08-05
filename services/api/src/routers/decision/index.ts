import { mergeRouters } from '../../trpcFactory';
import { instancesRouter } from './instances';
import { processesRouter } from './processes';

export const decisionRouter = mergeRouters(processesRouter, instancesRouter);