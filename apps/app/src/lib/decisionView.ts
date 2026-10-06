import type { loadDecision } from '@/server/decisions/loadDecision';
import { getRouteApi } from '@tanstack/react-router';
import { useMemo } from 'react';
import superjson from 'superjson';

import type { ProcessBuilderInstanceData } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';

/**
 * A decision's stored JSON (`instanceData`, field values) is `unknown` to the
 * type system, which a server function can't promise to serialize. These
 * payloads travel as superjson strings — the encoding tRPC already uses — and
 * are parsed where they're read.
 */
export type DecisionView = Awaited<ReturnType<typeof loadDecision>>;

export const serializeDecisionView = (view: DecisionView): string =>
  superjson.stringify(view);

export const parseDecisionView = (serialized: string): DecisionView =>
  superjson.parse<DecisionView>(serialized);

export interface DecisionEditor {
  decisionProfileId: string;
  decisionName: string;
  instanceId: string;
  isDraft: boolean;
  serverData: ProcessBuilderInstanceData;
}

export const serializeDecisionEditor = (editor: DecisionEditor): string =>
  superjson.stringify(editor);

export const parseDecisionEditor = (serialized: string): DecisionEditor =>
  superjson.parse<DecisionEditor>(serialized);

const decisionViewRoute = getRouteApi(
  '/$locale/_noHeader/decisions/$slug/_decisionView',
);

/** The decision the overview and current-phase tabs share, from their layout. */
export const useDecisionView = (): DecisionView => {
  const serialized = decisionViewRoute.useLoaderData();

  return useMemo(() => parseDecisionView(serialized), [serialized]);
};
