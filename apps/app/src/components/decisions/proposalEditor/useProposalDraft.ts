import { trpc } from '@op/api/client';
import {
  type BudgetData,
  type LocationData,
  type Proposal,
  type ProposalDataInput,
  normalizeBudget,
  normalizeLocation,
  normalizeProposalCategories,
  parseProposalData,
} from '@op/common/client';
import { useDebouncedCallback } from '@op/hooks';
import { logger } from '@op/logging/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Draft state for the proposal system fields. The proposal title is sourced
 * from the linked profile name, while category/budget are persisted in
 * proposalData. Yjs remains the source of truth for collaborative fields.
 * Dynamic template fields live exclusively in Yjs and are NOT part of this.
 */
export interface ProposalDraftFields extends Record<string, unknown> {
  title: string;
  category: string[];
  budget: BudgetData | null;
  location: LocationData | null;
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
      category: parsedProposalData?.category ?? [],
      budget: parsedProposalData?.budget ?? null,
      location: parsedProposalData?.location ?? null,
    }),
    [
      proposal.profile.name,
      parsedProposalData?.category,
      parsedProposalData?.budget,
      parsedProposalData?.location,
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
      logger.error('Auto-save failed', {
        error,
        context: 'useProposalDraft.autoSave',
      });
    },
  });

  /** Builds the proposalData payload for server persistence */
  const buildProposalData = useCallback(
    (nextDraft: ProposalDraftFields): ProposalDataInput => {
      const serverData = parseProposalData(proposal?.proposalData);
      return {
        ...serverData,
        collaborationDocId,
        category:
          nextDraft.category.length > 0 ? nextDraft.category : undefined,
        budget: nextDraft.budget ?? undefined,
        location: nextDraft.location ?? undefined,
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
   * fields (title, category, budget, location) and triggers a debounced
   * autosave — but only when the value actually changed.
   *
   * Collaborative fields emit their current value via `onChange` on mount.
   * Without the change guard below, merely opening the editor would fire an
   * autosave that re-persists the (possibly stale/divergent) fragment state,
   * churning the proposal's location and category on every open. Dynamic
   * fields live exclusively in Yjs and never affect the system snapshot, so
   * they never trigger an autosave here.
   */
  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      setDraft((prev) => {
        const next = { ...prev };
        let systemFieldChanged = false;

        if (key === 'title') {
          next.title = typeof value === 'string' ? value : '';
          systemFieldChanged = next.title !== prev.title;
        } else if (key === 'category') {
          next.category = normalizeProposalCategories(value);
          systemFieldChanged =
            JSON.stringify(next.category) !== JSON.stringify(prev.category);
        } else if (key === 'budget') {
          next.budget = normalizeBudget(value) ?? null;
          systemFieldChanged =
            JSON.stringify(next.budget) !== JSON.stringify(prev.budget);
        } else if (key === 'location') {
          next.location = normalizeLocation(value) ?? null;
          systemFieldChanged =
            JSON.stringify(next.location) !== JSON.stringify(prev.location);
        }
        // Dynamic fields are Yjs-only — we don't store them in draft state.

        draftRef.current = next;
        if (systemFieldChanged) {
          debouncedAutoSave(next);
        }
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
