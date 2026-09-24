'use client';

import { useIsMobile } from '@/hooks/useIsMobile';
import { parseAsString, useQueryState } from 'nuqs';
import { type ReactNode, useCallback, useMemo } from 'react';

import { ProposalSheet, type ProposalSheetRoute } from './ProposalSheet';
import {
  PROPOSAL_SHEET_PARAM,
  type ProposalSheetApi,
  ProposalSheetContext,
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
  children,
}: ProposalSheetRoute & { children: ReactNode }) {
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

  const api = useMemo<ProposalSheetApi | null>(
    () => (isMobile ? null : { open }),
    [isMobile, open],
  );

  return (
    <ProposalSheetContext.Provider value={api}>
      {children}
      {api ? (
        <ProposalSheet
          profileId={openProfileId}
          route={{ slug, instanceId, decisionSlug }}
          onClose={close}
        />
      ) : null}
    </ProposalSheetContext.Provider>
  );
}
