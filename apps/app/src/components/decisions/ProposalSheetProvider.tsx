'use client';

import { parseAsString, useQueryState } from 'nuqs';
import { type ReactNode, useCallback, useMemo } from 'react';

import { ProposalSheet, type ProposalSheetRoute } from './ProposalSheet';
import {
  PROPOSAL_SHEET_PARAM,
  type ProposalSheetApi,
  ProposalSheetContext,
} from './proposalSheetState';

/**
 * Owns the proposal side sheet a decision page can have open, above the cards
 * rather than inside the one whose title opened it.
 *
 * Above the cards for the same reason {@link ProposalCardDialogProvider} is:
 * the grid lays its cards out with `react-masonry-css`, which hands child `i`
 * to column `i % columns`, so one proposal arriving — a submission from someone
 * else, refetched by channel invalidation — moves every card into a different
 * column and React unmounts and remounts all of them. A sheet owned by the card
 * would close mid-read.
 *
 * Mounted once, on `DecisionStateRouter`: every phase view passes through it, so
 * one sheet serves every card surface on the page — the browse grid, the map,
 * the results tabs.
 *
 * The open proposal lives in the URL (`?proposal=<profileId>`), like
 * {@link DecisionSidePanel}, so the panel is linkable and Back closes it.
 */
export function ProposalSheetProvider({
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
