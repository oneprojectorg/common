import type { ProcessBuilderInstanceData } from './stores/useProcessBuilderStore';

type OverviewPatch = NonNullable<ProcessBuilderInstanceData['overview']>;
type PhasePatch = NonNullable<ProcessBuilderInstanceData['phases']>[number];

/**
 * Translates an emptied headline field into the API's explicit "clear this"
 * signal.
 *
 * A text input holds `''` while an admin is between values, but an empty title
 * is not valid content — `updateDecisionInstance` rejects it. `null` is the
 * clear: the stored headline is deleted and the page falls back to its default
 * copy. An absent key still means "leave it unchanged", so a patch that never
 * touched the headline is passed through untouched.
 */
export const toOverviewInput = (overview: OverviewPatch | undefined) =>
  overview && { ...overview, ...clearedHeadline(overview) };

export const toPhasesInput = (phases: PhasePatch[] | undefined) =>
  phases?.map((phase) => ({ ...phase, ...clearedHeadline(phase) }));

const clearedHeadline = ({ headline }: { headline?: string }) =>
  headline === undefined ? {} : { headline: headline.trim() || null };
