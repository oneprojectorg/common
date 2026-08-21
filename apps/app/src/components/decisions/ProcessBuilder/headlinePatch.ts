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
 * touched the headline is passed through by identity.
 *
 * `headline` is the only key either function writes — every other field of the
 * patch reaches the endpoint exactly as the store held it, and the endpoint
 * merges the patch into the stored data key by key, so fields the builder never
 * sent keep their saved values.
 */
export const toOverviewInput = (overview: OverviewPatch | undefined) =>
  overview?.headline === undefined
    ? overview
    : { ...overview, headline: clearIfBlank(overview.headline) };

export const toPhasesInput = (phases: PhasePatch[] | undefined) =>
  phases?.map((phase) =>
    phase.headline === undefined
      ? phase
      : { ...phase, headline: clearIfBlank(phase.headline) },
  );

const clearIfBlank = (headline: string) => headline.trim() || null;
