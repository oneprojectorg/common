import { mergeRouters } from '../../../trpcFactory';
import { createPhaseRouter } from './createPhase';
import { deletePhaseRouter } from './deletePhase';
import { reorderPhasesRouter } from './reorderPhases';
import { updatePhaseRouter } from './updatePhase';

export const phasesRouter = mergeRouters(
  createPhaseRouter,
  updatePhaseRouter,
  reorderPhasesRouter,
  deletePhaseRouter,
);
