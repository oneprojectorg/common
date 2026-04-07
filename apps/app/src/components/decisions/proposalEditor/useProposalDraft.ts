import { trpc } from '@op/api/client';
import {
  type BudgetData,
  type Proposal,
  type ProposalDataInput,
  normalizeBudget,
  parseProposalData,
} from '@op/common/client';
import { useDebouncedCallback } from '@op/hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Draft state for the proposal system fields. The proposal title is sourced
 * from the linked profile name, while category/budget are persisted in
 * proposalData. Yjs remains the source of truth for collaborative fields.
 * Dynamic template fields live exclusively in Yjs and are NOT part of this.
 */
export interface ProposalDraftFields extends Record<string, unknown> {
  title: string;
  category: string | null;
  budget: BudgetData | null;
}

/**
 * Manages the proposal draft lifecycle: parsing server data into local state,
 * syncing field changes, and debounced auto-save back to the server.
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
      title: proposal.profile.name ?? '',
      category: parsedProposalData?.category ?? null,
      budget: parsedProposalData?.budget ?? null,
    }),
    [
      proposal.profile.name,
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
        category: nextDraft.category ?? undefined,
        budget: nextDraft.budget ?? undefined,
      };
    },
    [proposal?.proposalData, collaborationDocId],
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
          title: draftToPersist.title,
          proposalData: buildProposalData(draftToPersist),
        },
      });
    },
    [proposal, autoSaveMutation, buildProposalData],
  );

  const debouncedAutoSave = useDebouncedCallback(saveFields, 1500);

  /**
   * Handles a single field change. Updates the draft state for system
   * fields (title, category, budget) and triggers debounced autosave.
   *
   * Dynamic field values are managed exclusively by Yjs — calling this
   * for dynamic fields is a no-op for persistence but still triggers
   * autosave of the current system field snapshot.
   */
  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      setDraft((prev) => {
        const next = { ...prev };

        if (key === 'title') {
          next.title = typeof value === 'string' ? value : '';
        } else if (key === 'category') {
          next.category = typeof value === 'string' ? value : null;
        } else if (key === 'budget') {
          next.budget = normalizeBudget(value) ?? null;
        }
        // Dynamic fields are Yjs-only — we don't store them in draft state.

        draftRef.current = next;
        debouncedAutoSave(next);
        return next;
      });
    },
    [debouncedAutoSave],
  );

  return {
    draft,
    draftRef,
    buildProposalData,
    handleFieldChange,
  };
}
