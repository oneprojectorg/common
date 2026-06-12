/**
 * Process Builder Store
 *
 * In-memory form state for the Process Builder. Nothing is persisted to
 * localStorage — what you see is either server data or edits from the
 * current browser session.
 *
 * ## Data Flow
 * 1. `ProcessBuilderStoreInitializer` seeds `instances` with server data
 *    overlaid with dirty fields (dirty survives client-side navigation
 *    away from and back to the editor)
 * 2. Form components read from `instances`
 * 3. Edit setters update `instances` AND record the fields in `dirty`
 * 4. Only edited fields are sent to the API — draft autosave via its own
 *    debounce accumulator, "Update Process" via the `dirty` map
 *
 * Unsaved published-process edits die with the page; the autosave
 * provider warns via `beforeunload`. A hard refresh always shows server
 * truth — local state can never shadow another admin's saved changes.
 *
 * ## Structure
 * Data is keyed by `decisionId` to support multiple concurrent drafts:
 * - `instances[decisionId]` - Merged view aligned with backend InstanceData
 * - `dirty[decisionId]` - Locally-edited fields not yet confirmed saved
 * - `saveStates[decisionId]` - UI save indicator state
 */
import type { InstanceData, InstancePhaseData } from '@op/api/encoders';
import type { ProposalTemplateSchema, RubricTemplateSchema } from '@op/common';
import { create } from 'zustand';

// ============ Store-specific Types ============

/**
 * Editable instance data for the process builder.
 *
 * Mirrors the server shape: inherits `config`, `phases`, etc. from
 * `InstanceData` and adds instance-column fields (`name`, `description`,
 * `stewardProfileId`) that live outside the JSON blob.
 */
export interface ProcessBuilderInstanceData extends Omit<
  Partial<InstanceData>,
  'proposalTemplate' | 'rubricTemplate'
> {
  // Instance columns (not in instanceData JSON)
  name?: string;
  description?: string;
  stewardProfileId?: string;

  // Override InstanceData's generic JSON Schema types with specific ones
  proposalTemplate?: ProposalTemplateSchema;
  rubricTemplate?: RubricTemplateSchema;
}

// ============ UI-only Types ============

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveState {
  status: SaveStatus;
  savedAt?: Date;
}

// ============ Store Interface ============

interface ProcessBuilderState {
  // Merged view (server data + local edits), keyed by decisionId.
  instances: Record<string, ProcessBuilderInstanceData>;
  // Locally-edited fields keyed by decisionId.
  dirty: Record<string, Partial<ProcessBuilderInstanceData>>;
  // Save state keyed by decisionId
  saveStates: Record<string, SaveState>;

  // Seeds the merged view with server-derived data WITHOUT marking
  // anything dirty. Replaces the instance entry wholesale.
  seedInstance: (decisionId: string, data: ProcessBuilderInstanceData) => void;

  // Actions for instance data (user edits — mark fields dirty)
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

  // Actions for rubric template
  setRubricTemplateSchema: (
    decisionId: string,
    template: RubricTemplateSchema,
  ) => void;
  getRubricTemplateSchema: (
    decisionId: string,
  ) => RubricTemplateSchema | undefined;

  // Actions for save state
  setSaveStatus: (decisionId: string, status: SaveStatus) => void;
  markSaved: (decisionId: string) => void;
  getSaveState: (decisionId: string) => SaveState;

  // Cleanup actions
  clearDirty: (decisionId: string) => void;
  /** Removes confirmed-saved fields — `dirty` must only ever hold
   *  unsaved or failed edits, or seeding would overlay stale data. */
  clearDirtyFields: (
    decisionId: string,
    fields: Partial<ProcessBuilderInstanceData>,
  ) => void;
  clearInstance: (decisionId: string) => void;
  reset: () => void;
}

const DEFAULT_SAVE_STATE: SaveState = { status: 'idle' };

export const useProcessBuilderStore = create<ProcessBuilderState>()(
  (set, get) => ({
    instances: {},
    dirty: {},
    saveStates: {},

    seedInstance: (decisionId, data) =>
      set((state) => ({
        instances: {
          ...state.instances,
          [decisionId]: data,
        },
      })),

    // Instance data actions
    setInstanceData: (decisionId, data) =>
      set((state) => {
        const existing = state.instances[decisionId];
        const existingDirty = state.dirty[decisionId];
        const { config, ...rest } = data;

        // No `config: undefined` entry — it would keep the dirty map
        // non-empty after everything is confirmed saved.
        const dirtyEntry: Partial<ProcessBuilderInstanceData> = {
          ...existingDirty,
          ...rest,
        };
        if (config || existingDirty?.config) {
          dirtyEntry.config = { ...existingDirty?.config, ...config };
        }

        return {
          instances: {
            ...state.instances,
            [decisionId]: {
              ...existing,
              ...data,
              config: { ...existing?.config, ...config },
            },
          },
          dirty: {
            ...state.dirty,
            [decisionId]: dirtyEntry,
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
          dirty: {
            ...state.dirty,
            [decisionId]: {
              ...state.dirty[decisionId],
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
        dirty: {
          ...state.dirty,
          [decisionId]: {
            ...state.dirty[decisionId],
            proposalTemplate: template,
          },
        },
      })),

    getProposalTemplateSchema: (decisionId) =>
      get().instances[decisionId]?.proposalTemplate,

    // Rubric template actions
    setRubricTemplateSchema: (decisionId, template) =>
      set((state) => ({
        instances: {
          ...state.instances,
          [decisionId]: {
            ...state.instances[decisionId],
            rubricTemplate: template,
          },
        },
        dirty: {
          ...state.dirty,
          [decisionId]: {
            ...state.dirty[decisionId],
            rubricTemplate: template,
          },
        },
      })),

    getRubricTemplateSchema: (decisionId) =>
      get().instances[decisionId]?.rubricTemplate,

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
    clearDirty: (decisionId) =>
      set((state) => {
        const { [decisionId]: _, ...restDirty } = state.dirty;
        return { dirty: restDirty };
      }),

    clearDirtyFields: (decisionId, fields) =>
      set((state) => {
        const existing = state.dirty[decisionId];
        if (!existing) {
          return state;
        }

        const { config: savedConfig, ...savedRest } = fields;
        const remaining: Partial<ProcessBuilderInstanceData> = {
          ...existing,
        };
        for (const key of Object.keys(savedRest)) {
          delete remaining[key as keyof ProcessBuilderInstanceData];
        }

        // Config is accumulated per sub-key, so clear at that granularity
        if (savedConfig && remaining.config) {
          const remainingConfig = { ...remaining.config };
          for (const key of Object.keys(savedConfig)) {
            delete remainingConfig[key as keyof typeof remainingConfig];
          }
          if (Object.keys(remainingConfig).length > 0) {
            remaining.config = remainingConfig;
          } else {
            delete remaining.config;
          }
        }

        if (Object.keys(remaining).length === 0) {
          const { [decisionId]: _, ...restDirty } = state.dirty;
          return { dirty: restDirty };
        }
        return {
          dirty: {
            ...state.dirty,
            [decisionId]: remaining,
          },
        };
      }),

    clearInstance: (decisionId) =>
      set((state) => {
        const { [decisionId]: _, ...restInstances } = state.instances;
        const { [decisionId]: __, ...restDirty } = state.dirty;
        const { [decisionId]: ___, ...restSaveStates } = state.saveStates;
        return {
          instances: restInstances,
          dirty: restDirty,
          saveStates: restSaveStates,
        };
      }),

    reset: () =>
      set({
        instances: {},
        dirty: {},
        saveStates: {},
      }),
  }),
);
