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
 * Mounted once per decision page, above the cards: masonry re-parents every
 * card when one proposal arrives, so a sheet owned by a card would close
 * mid-read.
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
