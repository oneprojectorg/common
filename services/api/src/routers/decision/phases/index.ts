import { mergeRouters } from '../../../trpcFactory';
import { createPhaseRouter } from './createPhase';

export const phasesRouter = mergeRouters(createPhaseRouter);
