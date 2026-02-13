/**
 * Process Builder Store
 *
 * Manages form state for the Process Builder with localStorage persistence.
 * This store acts as a client-side cache for in-progress form data, allowing
 * users to navigate away and return without losing their work.
 *
 * ## Data Flow
 * 1. Form components read initial values from this store (after hydration)
 * 2. Auto-save writes debounced form values back to this store
 * 3. Store persists to localStorage automatically via Zustand middleware
 * 4. On form submission, data is sent to the API
 *
 * ## Hydration
 * This store uses `skipHydration: true` to prevent race conditions in SSR.
 * Components must manually trigger hydration:
 *
 * ```tsx
 * useEffect(() => {
 *   const unsubscribe = useProcessBuilderStore.persist.onFinishHydration(() => {
 *     setHasHydrated(true);
 *   });
 *   void useProcessBuilderStore.persist.rehydrate();
 *   return unsubscribe;
 * }, []);
 * ```
 *
 * ## Structure
 * Data is keyed by `decisionId` to support multiple concurrent drafts:
 * - `instances[decisionId]` - Form data aligned with backend InstanceData
 * - `saveStates[decisionId]` - UI save indicator state
 */
import type { InstanceData, InstancePhaseData } from '@op/api/encoders';
import type { ProposalCategory } from '@op/common';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ProposalTemplate } from '../../proposalTemplate';

// ============ Store-specific Types ============

/**
 * Extended instance data for form state.
 * Includes fields stored separately in the DB but tracked together for form convenience.
 *
 * Backend-aligned fields (from InstanceData):
 * - budget, hideBudget, fieldValues, currentPhaseId, stateData, phases
 *
 * Form-only fields (not yet in backend, stored in localStorage only):
 * - steward, objective, includeReview, isPrivate
 */
export interface FormInstanceData
  extends Omit<Partial<InstanceData>, 'proposalTemplate'> {
  /** Instance name (stored in processInstances.name, not instanceData) */
  name?: string;
  /** Instance description (stored in processInstances.description, not instanceData) */
  description?: string;

  // Form-only fields (not in backend InstanceData yet)
  // TODO: Add these to backend schema when ready to persist
  /** Profile ID of the steward */
  stewardProfileId?: string;
  /** Process objective description */
  objective?: string;
  /** Total budget available */
  budget?: number;
  /** Whether to hide budget from members */
  hideBudget?: boolean;
  /** Whether to include proposal review phase */
  includeReview?: boolean;
  /** Whether to keep process private */
  isPrivate?: boolean;
  /** Whether to organize proposals into categories */
  organizeByCategories?: boolean;
  /** Whether to require collaborative proposals */
  requireCollaborativeProposals?: boolean;
  /** Proposal template (JSON Schema) */
  proposalTemplate?: ProposalTemplate;
  /** Proposal categories */
  categories?: ProposalCategory[];
  /** Whether proposers must select at least one category */
  requireCategorySelection?: boolean;
  /** Whether proposers can select more than one category */
  allowMultipleCategories?: boolean;
}

// ============ UI-only Types ============

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveState {
  status: SaveStatus;
  savedAt?: Date;
}

// ============ Store Interface ============

interface ProcessBuilderState {
  // Instance data keyed by decisionId
  instances: Record<string, FormInstanceData>;
  // Save state keyed by decisionId
  saveStates: Record<string, SaveState>;

  // Actions for instance data
  setInstanceData: (
    decisionId: string,
    data: Partial<FormInstanceData>,
  ) => void;
  getInstanceData: (decisionId: string) => FormInstanceData | undefined;

  // Actions for phase data (operates on phases array)
  setPhaseData: (
    decisionId: string,
    phaseId: string,
    data: Partial<InstancePhaseData>,
  ) => void;
  getPhaseData: (
    decisionId: string,
    phaseId: string,
  ) => InstancePhaseData | undefined;

  // Actions for proposal template
  setProposalTemplate: (decisionId: string, template: ProposalTemplate) => void;
  getProposalTemplate: (decisionId: string) => ProposalTemplate | undefined;

  // Actions for save state
  setSaveStatus: (decisionId: string, status: SaveStatus) => void;
  markSaved: (decisionId: string) => void;
  getSaveState: (decisionId: string) => SaveState;

  // Cleanup actions
  clearInstance: (decisionId: string) => void;
  reset: () => void;
}

const DEFAULT_SAVE_STATE: SaveState = { status: 'idle' };

export const useProcessBuilderStore = create<ProcessBuilderState>()(
  persist(
    (set, get) => ({
      instances: {},
      saveStates: {},

      // Instance data actions
      setInstanceData: (decisionId, data) =>
        set((state) => ({
          instances: {
            ...state.instances,
            [decisionId]: {
              ...state.instances[decisionId],
              ...data,
            },
          },
        })),

      getInstanceData: (decisionId) => get().instances[decisionId],

      // Phase data actions (operates on phases array)
      setPhaseData: (decisionId, phaseId, data) =>
        set((state) => {
          const instance = state.instances[decisionId];
          const existingPhases = instance?.phases ?? [];

          // Find existing phase or create new entry
          const phaseIndex = existingPhases.findIndex(
            (p) => p.phaseId === phaseId,
          );

          let updatedPhases: InstancePhaseData[];
          if (phaseIndex >= 0) {
            // Update existing phase
            updatedPhases = existingPhases.map((phase, idx) =>
              idx === phaseIndex ? { ...phase, ...data } : phase,
            );
          } else {
            // Add new phase
            updatedPhases = [...existingPhases, { phaseId, ...data }];
          }

          return {
            instances: {
              ...state.instances,
              [decisionId]: {
                ...instance,
                phases: updatedPhases,
              },
            },
          };
        }),

      getPhaseData: (decisionId, phaseId) => {
        const phases = get().instances[decisionId]?.phases;
        return phases?.find((p) => p.phaseId === phaseId);
      },

      // Proposal template actions
      setProposalTemplate: (decisionId, template) =>
        set((state) => ({
          instances: {
            ...state.instances,
            [decisionId]: {
              ...state.instances[decisionId],
              proposalTemplate: template,
            },
          },
        })),

      getProposalTemplate: (decisionId) =>
        get().instances[decisionId]?.proposalTemplate,

      // Save state actions
      setSaveStatus: (decisionId, status) =>
        set((state) => ({
          saveStates: {
            ...state.saveStates,
            [decisionId]: {
              ...state.saveStates[decisionId],
              status,
            },
          },
        })),

      markSaved: (decisionId) =>
        set((state) => ({
          saveStates: {
            ...state.saveStates,
            [decisionId]: {
              status: 'saved',
              savedAt: new Date(),
            },
          },
        })),

      getSaveState: (decisionId) =>
        get().saveStates[decisionId] ?? DEFAULT_SAVE_STATE,

      // Cleanup actions
      clearInstance: (decisionId) =>
        set((state) => {
          const { [decisionId]: _, ...restInstances } = state.instances;
          const { [decisionId]: __, ...restSaveStates } = state.saveStates;
          return {
            instances: restInstances,
            saveStates: restSaveStates,
          };
        }),

      reset: () =>
        set({
          instances: {},
          saveStates: {},
        }),
    }),
    {
      name: 'process-builder',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
