import { mergeRouters } from '../../../trpcFactory';
import { createPhaseRouter } from './createPhase';
import { deletePhaseRouter } from './deletePhase';
import { updatePhaseRouter } from './updatePhase';

export const phasesRouter = mergeRouters(
  createPhaseRouter,
  updatePhaseRouter,
  deletePhaseRouter,
);
