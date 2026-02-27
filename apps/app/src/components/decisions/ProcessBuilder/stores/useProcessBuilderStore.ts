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
import type { ProposalTemplateSchema } from '@op/common';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// ============ Store-specific Types ============

/**
 * Editable instance data for the process builder.
 *
 * Mirrors the server shape: inherits `config`, `phases`, etc. from
 * `InstanceData` and adds instance-column fields (`name`, `description`,
 * `stewardProfileId`) that live outside the JSON blob.
 */
export interface ProcessBuilderInstanceData
  extends Omit<Partial<InstanceData>, 'proposalTemplate'> {
  // Instance columns (not in instanceData JSON)
  name?: string;
  description?: string;
  stewardProfileId?: string;

  // Override InstanceData's proposalTemplate with form-specific type
  proposalTemplate?: ProposalTemplateSchema;
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
  instances: Record<string, ProcessBuilderInstanceData>;
  // Save state keyed by decisionId
  saveStates: Record<string, SaveState>;

  // Actions for instance data
  setInstanceData: (
    decisionId: string,
    data: Partial<ProcessBuilderInstanceData>,
  ) => void;
  getInstanceData: (
    decisionId: string,
  ) => ProcessBuilderInstanceData | undefined;

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
  setProposalTemplateSchema: (
    decisionId: string,
    template: ProposalTemplateSchema,
  ) => void;
  getProposalTemplateSchema: (
    decisionId: string,
  ) => ProposalTemplateSchema | undefined;

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
        set((state) => {
          const existing = state.instances[decisionId];
          return {
            instances: {
              ...state.instances,
              [decisionId]: {
                ...existing,
                ...data,
                config: { ...existing?.config, ...data.config },
              },
            },
          };
        }),

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
      setProposalTemplateSchema: (decisionId, template) =>
        set((state) => ({
          instances: {
            ...state.instances,
            [decisionId]: {
              ...state.instances[decisionId],
              proposalTemplate: template,
            },
          },
        })),

      getProposalTemplateSchema: (decisionId) =>
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
