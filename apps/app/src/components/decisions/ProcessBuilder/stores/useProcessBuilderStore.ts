import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Option } from '@op/ui/MultiSelectComboBox';

// Matches OverviewFormData in OverviewSection.tsx
export interface OverviewFormData {
  steward: string;
  focusAreas: Option[];
  aims: string[];
  processName: string;
  description: string;
  budget: number | null;
  hideBudget: boolean;
  organizeCategories: boolean;
  multiPhase: boolean;
  includeReview: boolean;
  isPrivate: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ProcessBuilderState {
  // Form data keyed by decisionId for multi-instance support
  forms: Record<string, Partial<OverviewFormData>>;
  // Save status keyed by decisionId
  saveStatus: Record<string, SaveStatus>;

  // Actions
  setFormData: (
    decisionId: string,
    data: Partial<OverviewFormData>
  ) => void;
  getFormData: (decisionId: string) => Partial<OverviewFormData> | undefined;
  setSaveStatus: (decisionId: string, status: SaveStatus) => void;
  clearFormData: (decisionId: string) => void;
  reset: () => void;
}

export const useProcessBuilderStore = create<ProcessBuilderState>()(
  persist(
    (set, get) => ({
      forms: {},
      saveStatus: {},

      setFormData: (decisionId, data) =>
        set((state) => ({
          forms: {
            ...state.forms,
            [decisionId]: {
              ...state.forms[decisionId],
              ...data,
            },
          },
        })),

      getFormData: (decisionId) => get().forms[decisionId],

      setSaveStatus: (decisionId, status) =>
        set((state) => ({
          saveStatus: {
            ...state.saveStatus,
            [decisionId]: status,
          },
        })),

      clearFormData: (decisionId) =>
        set((state) => {
          const { [decisionId]: _, ...restForms } = state.forms;
          const { [decisionId]: __, ...restStatus } = state.saveStatus;
          return {
            forms: restForms,
            saveStatus: restStatus,
          };
        }),

      reset: () =>
        set({
          forms: {},
          saveStatus: {},
        }),
    }),
    {
      name: 'process-builder-overview',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
