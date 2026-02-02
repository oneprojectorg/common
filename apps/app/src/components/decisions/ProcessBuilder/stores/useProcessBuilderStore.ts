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
 * 4. On form submission, data is sent to the API (TODO: not yet implemented)
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
 * - `instances[decisionId]` - Form data (name, description, config, phases)
 * - `saveStatus[decisionId]` - UI save indicator state
 */
import type { Option } from '@op/ui/MultiSelectComboBox';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// ============ Instance Data Types ============

/**
 * Process-level configuration.
 * These settings apply to the entire decision process.
 */
export interface ProcessConfig {
  // Process Stewardship
  steward?: string;
  focusAreas?: Option[];
  aims?: string[];

  // Process Details
  budget?: number | null;
  hideBudget?: boolean;
  organizeCategories?: boolean;
  multiPhase?: boolean;
  includeReview?: boolean;
  isPrivate?: boolean;
}

/**
 * Phase-specific settings.
 * The `settings` object is dynamic and defined by the schema.
 */
export interface PhaseData {
  startDate?: string;
  endDate?: string;
  // Dynamic settings based on schema (e.g., budget, maxProposalsPerMember, maxVotesPerMember)
  settings?: Record<string, unknown>;
}

/**
 * Complete instance data structure.
 * Mirrors the database instanceData JSONB structure.
 */
export interface InstanceData {
  // Top-level instance fields (stored separately in DB but tracked here for form state)
  name?: string;
  description?: string;

  // Process-level configuration
  config?: ProcessConfig;

  // Phase-specific data, keyed by phase ID (e.g., 'submission', 'review', 'voting', 'results')
  phases?: Record<string, PhaseData>;
}

// ============ Store Types ============

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveState {
  status: SaveStatus;
  savedAt?: Date;
}

interface ProcessBuilderState {
  // Instance data keyed by decisionId
  instances: Record<string, InstanceData>;
  // Save state keyed by decisionId
  saveStates: Record<string, SaveState>;

  // Actions for instance data
  setInstanceData: (decisionId: string, data: Partial<InstanceData>) => void;
  getInstanceData: (decisionId: string) => InstanceData | undefined;

  // Actions for config (process-level settings)
  setConfig: (decisionId: string, config: Partial<ProcessConfig>) => void;
  getConfig: (decisionId: string) => ProcessConfig | undefined;

  // Actions for phase data
  setPhaseData: (
    decisionId: string,
    phaseId: string,
    data: Partial<PhaseData>,
  ) => void;
  getPhaseData: (decisionId: string, phaseId: string) => PhaseData | undefined;

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

      // Config actions
      setConfig: (decisionId, config) =>
        set((state) => ({
          instances: {
            ...state.instances,
            [decisionId]: {
              ...state.instances[decisionId],
              config: {
                ...state.instances[decisionId]?.config,
                ...config,
              },
            },
          },
        })),

      getConfig: (decisionId) => get().instances[decisionId]?.config,

      // Phase data actions
      setPhaseData: (decisionId, phaseId, data) =>
        set((state) => ({
          instances: {
            ...state.instances,
            [decisionId]: {
              ...state.instances[decisionId],
              phases: {
                ...state.instances[decisionId]?.phases,
                [phaseId]: {
                  ...state.instances[decisionId]?.phases?.[phaseId],
                  ...data,
                },
              },
            },
          },
        })),

      getPhaseData: (decisionId, phaseId) =>
        get().instances[decisionId]?.phases?.[phaseId],

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
