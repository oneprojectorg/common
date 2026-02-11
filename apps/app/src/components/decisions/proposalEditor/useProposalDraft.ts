import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { type ProposalDataInput, parseProposalData } from '@op/common/client';
import { useDebouncedCallback } from '@op/hooks';
import type { IChangeEvent } from '@rjsf/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';

type Proposal = z.infer<typeof proposalEncoder>;

/**
 * Draft state for the three system fields duplicated to proposalData
 * for search, preview, and sorting. Yjs is the source of truth — the
 * DB copy is a derived snapshot.
 * Dynamic template fields live exclusively in Yjs and are NOT part of this.
 */
export interface ProposalDraftFields extends Record<string, unknown> {
  title: string;
  category: string | null;
  budget: number | null;
}

/**
 * Manages the proposal draft lifecycle: parsing server data into local state,
 * syncing RJSF form changes, and debounced auto-save back to the server.
 */
export function useProposalDraft({
  proposal,
  isEditMode,
  collaborationDocId,
}: {
  proposal: Proposal;
  isEditMode: boolean;
  collaborationDocId: string;
}) {
  // -- Parsed server state --------------------------------------------------

  const parsedProposalData = useMemo(
    () =>
      isEditMode && proposal ? parseProposalData(proposal.proposalData) : null,
    [isEditMode, proposal],
  );

  const initialDraft = useMemo<ProposalDraftFields>(
    () => ({
      title: parsedProposalData?.title ?? '',
      category: parsedProposalData?.category ?? null,
      budget: parsedProposalData?.budget ?? null,
    }),
    [
      parsedProposalData?.title,
      parsedProposalData?.category,
      parsedProposalData?.budget,
    ],
  );

  const [draft, setDraft] = useState<ProposalDraftFields>(initialDraft);
  const draftRef = useRef<ProposalDraftFields>(initialDraft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    draftRef.current = initialDraft;
    setDraft(initialDraft);
  }, [initialDraft]);

  // -- Auto-save mutation ---------------------------------------------------

  const autoSaveMutation = trpc.decision.updateProposal.useMutation({
    onError: (error) => {
      console.error('Auto-save failed:', error);
    },
  });

  /** Builds the proposalData payload for server persistence */
  const buildProposalData = useCallback(
    (nextDraft: ProposalDraftFields): ProposalDataInput => {
      const serverData = parseProposalData(proposal?.proposalData);
      return {
        ...serverData,
        collaborationDocId,
        title: nextDraft.title,
        category: nextDraft.category ?? undefined,
        budget: nextDraft.budget ?? undefined,
      };
    },
    [proposal?.proposalData, collaborationDocId],
  );

  /**
   * Extracts system draft fields from RJSF formData.
   * Dynamic field values are ignored — they sync via Yjs only.
   */
  const toProposalDraft = useCallback(
    (formData: Record<string, unknown>): ProposalDraftFields => ({
      title: typeof formData.title === 'string' ? formData.title : '',
      category:
        typeof formData.category === 'string' ? formData.category : null,
      budget: typeof formData.budget === 'number' ? formData.budget : null,
    }),
    [],
  );

  const saveFields = useCallback(
    (nextDraft?: ProposalDraftFields) => {
      if (!proposal) {
        return;
      }
      const draftToPersist = nextDraft ?? draftRef.current;

      autoSaveMutation.mutate({
        proposalId: proposal.id,
        data: {
          proposalData: buildProposalData(draftToPersist),
        },
      });
    },
    [proposal, autoSaveMutation, buildProposalData],
  );

  const debouncedAutoSave = useDebouncedCallback(saveFields, 1500);

  /**
   * Handles RJSF form changes. Extracts system fields into the draft
   * and triggers debounced autosave for persistence.
   */
  const handleFormChange = useCallback(
    (event: IChangeEvent<Record<string, unknown>>) => {
      const nextDraft = toProposalDraft(
        (event.formData ?? {}) as Record<string, unknown>,
      );
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      debouncedAutoSave(nextDraft);
    },
    [toProposalDraft, debouncedAutoSave],
  );

  return {
    draft,
    draftRef,
    buildProposalData,
    handleFormChange,
  };
}
