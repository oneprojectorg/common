import { mergeRouters } from '../../../trpcFactory';
import { createPhaseRouter } from './createPhase';
import { deletePhaseRouter } from './deletePhase';

export const phasesRouter = mergeRouters(createPhaseRouter, deletePhaseRouter);
