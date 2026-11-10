'use client';

import { isPlainLeftClick } from '@/utils/isPlainLeftClick';
import { type MouseEvent, createContext, useCallback, useContext } from 'react';

import type { ProposalRoute } from '../proposalHrefs';

/** Not `proposal` — `PromoteAccountModal` owns that key. */
export const PROPOSAL_SHEET_PARAM = 'proposalPanel';

export type ProposalSheetRoute = Omit<ProposalRoute, 'profileId'>;

export interface ProposalSheetControls {
  open: (profileId: string) => void;
}

export interface ProposalSheetState {
  openProfileId: string | null;
  route: ProposalSheetRoute;
  expandHref?: (profileId: string) => string;
  close: () => void;
}

/** Kept out of the provider file: the sheet renders cards that read this. */
export const ProposalSheetContext = createContext<ProposalSheetControls | null>(
  null,
);

/**
 * Apart from the controls, so the cards that open the sheet don't re-render
 * each time it opens or closes.
 */
export const ProposalSheetStateContext =
  createContext<ProposalSheetState | null>(null);

/**
 * Curried, so a list builds one handler per card. Returns `undefined` without
 * a provider, so the link stays a plain link.
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
