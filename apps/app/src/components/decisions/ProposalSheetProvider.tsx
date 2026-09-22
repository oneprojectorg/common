'use client';

import { parseAsString, useQueryState } from 'nuqs';
import { type ReactNode, useCallback, useContext, useMemo } from 'react';

import { ProposalSheet, type ProposalSheetRoute } from './ProposalSheet';
import {
  PROPOSAL_SHEET_PARAM,
  type ProposalSheetApi,
  ProposalSheetContext,
} from './proposalSheetState';

/**
 * Owns the proposal side sheet a decision surface can have open, above the
 * cards rather than inside the one whose title opened it.
 *
 * Above the cards for the same reason {@link ProposalCardDialogProvider} is:
 * the grid lays its cards out with `react-masonry-css`, which hands child `i`
 * to column `i % columns`, so one proposal arriving — a submission from someone
 * else, refetched by channel invalidation — moves every card into a different
 * column and React unmounts and remounts all of them. A sheet owned by the card
 * would close mid-read.
 *
 * The open proposal lives in the URL (`?proposal=<profileId>`), like
 * {@link DecisionSidePanel}, so the panel is linkable and Back closes it.
 *
 * Nesting is safe: an inner provider passes through rather than putting a
 * second panel on the same URL param. `DecisionStateRouter` mounts one around
 * every phase page so each page's card surfaces share one sheet, and
 * `ProposalsList` mounts its own so it still works anywhere else — on a phase
 * page the inner one defers.
 */
export function ProposalSheetProvider({
  children,
  ...route
}: ProposalSheetRoute & { children: ReactNode }) {
  const outer = useContext(ProposalSheetContext);

  if (outer) {
    return <>{children}</>;
  }

  return <OwnedProposalSheet {...route}>{children}</OwnedProposalSheet>;
}

/** The half that owns the state, split out so the guard above can return early. */
function OwnedProposalSheet({
  slug,
  instanceId,
  decisionSlug,
  children,
}: ProposalSheetRoute & { children: ReactNode }) {
  const [openProfileId, setOpenProfileId] = useQueryState(
    PROPOSAL_SHEET_PARAM,
    parseAsString,
  );

  // Pushed, so Back returns the reader to the list they opened it from.
  const open = useCallback(
    (profileId: string) => {
      void setOpenProfileId(profileId, { history: 'push' });
    },
    [setOpenProfileId],
  );

  // Replaced, so closing doesn't leave an entry that Back would reopen.
  const close = useCallback(() => {
    void setOpenProfileId(null);
  }, [setOpenProfileId]);

  // The opener is stable, so this is built once — every card reads it.
  const api = useMemo<ProposalSheetApi>(() => ({ open }), [open]);

  return (
    <ProposalSheetContext.Provider value={api}>
      {children}
      <ProposalSheet
        profileId={openProfileId}
        route={{ slug, instanceId, decisionSlug }}
        onClose={close}
      />
    </ProposalSheetContext.Provider>
  );
}
