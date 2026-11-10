import { createSafeStorage } from '@/utils/safeStorage';
import { toast } from '@op/sense/Toast';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const PERSONAL_DATA_EXPORT_READY_TOAST_ID = 'personal-data-export-ready';

export type PersonalDataExportState =
  | { phase: 'idle' }
  | { phase: 'running'; exportId: string; startedAt: number }
  | { phase: 'ready'; exportId: string; isPartial: boolean; readyAt: number };

interface PersonalDataExportStore {
  state: PersonalDataExportState;
  start: (exportId: string) => void;
  /** False when that run is not the current one or has already settled. */
  complete: (
    exportId: string,
    result: { isPartial: boolean; readyAt: number },
  ) => boolean;
  /** False when that run is not the current one. */
  reset: (exportId: string) => boolean;
  clear: () => void;
}

// Session storage so a run survives a reload. Hydration is skipped because the
// store is also built during the server render; the watcher rehydrates it.
export const usePersonalDataExportStore = create<PersonalDataExportStore>()(
  persist(
    (set, get) => ({
      state: { phase: 'idle' },
      start: (exportId) =>
        set({ state: { phase: 'running', exportId, startedAt: Date.now() } }),
      complete: (exportId, { isPartial, readyAt }) => {
        const { state } = get();
        if (state.phase !== 'running' || state.exportId !== exportId) {
          return false;
        }
        set({ state: { phase: 'ready', exportId, isPartial, readyAt } });
        return true;
      },
      reset: (exportId) => {
        const { state } = get();
        if (state.phase === 'idle' || state.exportId !== exportId) {
          return false;
        }
        set({ state: { phase: 'idle' } });
        return true;
      },
      clear: () => set({ state: { phase: 'idle' } }),
    }),
    {
      name: 'personal-data-export',
      storage: createJSONStorage(() => createSafeStorage(() => sessionStorage)),
      skipHydration: true,
    },
  ),
);

export const clearPersonalDataExport = () => {
  usePersonalDataExportStore.getState().clear();
  toast.close(PERSONAL_DATA_EXPORT_READY_TOAST_ID);
};
