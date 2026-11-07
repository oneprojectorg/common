'use client';

import { useIsMobile } from '@/hooks/useIsMobile';
import { parseAsString, useQueryState } from 'nuqs';
import { type ReactNode, useCallback, useMemo } from 'react';

import {
  PROPOSAL_SHEET_PARAM,
  type ProposalSheetControls,
  ProposalSheetContext,
  type ProposalSheetRoute,
  type ProposalSheetState,
  ProposalSheetStateContext,
} from './proposalSheetState';

/**
 * Mounted once per decision page, above the cards: masonry re-parents every
 * card when one proposal arrives, so a sheet owned by a card would close
 * mid-read.
 *
 * A phone gets no sheet at all — a panel there would cover the list it is
 * meant to preserve, so the card's title link is left to reach the proposal
 * page on its own.
 */
export function ProposalSheetProvider({
  slug,
  instanceId,
  decisionSlug,
  expandHref,
  children,
}: ProposalSheetRoute & {
  expandHref?: (profileId: string) => string;
  children: ReactNode;
}) {
  const [openProfileId, setOpenProfileId] = useQueryState(
    PROPOSAL_SHEET_PARAM,
    parseAsString,
  );
  const isMobile = useIsMobile();

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

  const controls = useMemo<ProposalSheetControls | null>(
    () => (isMobile ? null : { open }),
    [isMobile, open],
  );

  const state = useMemo<ProposalSheetState | null>(
    () =>
      isMobile
        ? null
        : {
            openProfileId,
            route: { slug, instanceId, decisionSlug },
            expandHref,
            close,
          },
    [
      isMobile,
      openProfileId,
      slug,
      instanceId,
      decisionSlug,
      expandHref,
      close,
    ],
  );

  return (
    <ProposalSheetContext.Provider value={controls}>
      <ProposalSheetStateContext.Provider value={state}>
        {children}
      </ProposalSheetStateContext.Provider>
    </ProposalSheetContext.Provider>
  );
}
