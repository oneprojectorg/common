import { mergeRouters } from '../../trpcFactory';
import { instancesRouter } from './instances';
import { processesRouter } from './processes';
import { proposalsRouter } from './proposals';

export const decisionRouter = mergeRouters(processesRouter, instancesRouter, proposalsRouter);
