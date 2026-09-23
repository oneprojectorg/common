'use client';

import { isPlainLeftClick } from '@/utils/isPlainLeftClick';
import { type MouseEvent, createContext, useCallback, useContext } from 'react';

/** Names the proposal the side sheet is open on — its profile id. */
export const PROPOSAL_SHEET_PARAM = 'proposal';

export interface ProposalSheetApi {
  /** Opens the sheet on a proposal, named by its profile id. */
  open: (profileId: string) => void;
}

/**
 * Split from `ProposalSheetProvider` rather than declared beside it because the
 * sheet renders proposal cards of its own (the merged-in ideas), and those
 * cards read this context. Holding it here keeps the card -> context ->
 * provider -> sheet -> card import loop open.
 */
export const ProposalSheetContext = createContext<ProposalSheetApi | null>(
  null,
);

/**
 * Builds the click handler for a link to a proposal that should open the side
 * sheet: `onClick={openInSheet(proposal.profileId)}`. Curried by profile id so
 * a list can build one per card inside its `map` — a hook can't be.
 *
 * The handler only cancels a plain left click. Every other kind —
 * middle-click, cmd/ctrl, shift, alt — is the reader asking for a tab, a window
 * or a download, so it falls through to the `href` and lands on the proposal's
 * own page. That is also why these controls stay links: the sheet is the
 * default way in, not the only one.
 *
 * Returns `undefined` off a decision page, where there is no provider, which
 * leaves the link a plain link. That is the wanted fallback, not a failure — a
 * proposal card with no list behind it (the merged-in ideas as rendered on the
 * proposal page) has nothing to preserve, so navigating is right there. It is
 * also what lets one wiring serve every card surface.
 */
export function useOpenProposalInSheet() {
  const open = useContext(ProposalSheetContext)?.open;

  return useCallback(
    (profileId: string) =>
      open
        ? (event: MouseEvent<HTMLElement>) => {
            if (!isPlainLeftClick(event)) {
              return;
            }

            event.preventDefault();
            open(profileId);
          }
        : undefined,
    [open],
  );
}
