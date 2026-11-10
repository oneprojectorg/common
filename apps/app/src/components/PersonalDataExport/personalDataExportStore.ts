import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Longest the client waits for one personal data export.
 *
 * The run collects and uploads in a single step, so it reports `processing` once
 * and then nothing until it settles. Silence is normal for a large account, and
 * only this total ends the wait.
 */
export const PERSONAL_DATA_EXPORT_MAX_WAIT_MS = 30 * 60 * 1000;

/** The ready toast's id, so a newer run can close an older run's offer. */
export const PERSONAL_DATA_EXPORT_READY_TOAST_ID = 'personal-data-export-ready';

export type PersonalDataExportState =
  | { phase: 'idle' }
  // the start request is in flight and there is no id yet
  | { phase: 'starting' }
  | { phase: 'running'; exportId: string; startedAt: number }
  // The file exists. Its link is read when the user asks for it, because a
  // signed URL expires and the server re-signs a stale one on read.
  | { phase: 'ready'; exportId: string; isPartial: boolean };

interface PersonalDataExportStore {
  state: PersonalDataExportState;
  /**
   * Claims the start. False when an export is already starting or running, so
   * a second instance of the button cannot start another.
   */
  begin: () => boolean;
  /** The start request returned an id. */
  start: (exportId: string) => void;
  /** The start request failed. */
  abort: () => void;
  /**
   * Moves a running export to ready. False when that run is not the current one
   * or has already settled, so a repeat settle reports nothing.
   */
  complete: (exportId: string, result: { isPartial: boolean }) => boolean;
  /** Returns to idle. False when that run is not the current one. */
  reset: (exportId: string) => boolean;
}

// Outside React so a run outlives the settings modal and every page header, and
// in session storage so it outlives a reload. Session rather than local storage
// keeps it to one tab, which is one signed-in user.
//
// Hydration is skipped at creation, because the store is built during the
// server render too. PersonalDataExportWatcher rehydrates it on mount.
export const usePersonalDataExportStore = create<PersonalDataExportStore>()(
  persist(
    (set, get) => ({
      state: { phase: 'idle' },
      begin: () => {
        const { phase } = get().state;
        if (phase === 'starting' || phase === 'running') {
          return false;
        }
        set({ state: { phase: 'starting' } });
        return true;
      },
      start: (exportId) => {
        if (get().state.phase !== 'starting') {
          return;
        }
        set({ state: { phase: 'running', exportId, startedAt: Date.now() } });
      },
      abort: () => {
        if (get().state.phase !== 'starting') {
          return;
        }
        set({ state: { phase: 'idle' } });
      },
      complete: (exportId, { isPartial }) => {
        const { state } = get();
        if (state.phase !== 'running' || state.exportId !== exportId) {
          return false;
        }
        set({ state: { phase: 'ready', exportId, isPartial } });
        return true;
      },
      reset: (exportId) => {
        const { state } = get();
        if (
          (state.phase !== 'running' && state.phase !== 'ready') ||
          state.exportId !== exportId
        ) {
          return false;
        }
        set({ state: { phase: 'idle' } });
        return true;
      },
    }),
    {
      name: 'personal-data-export',
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      // a start in flight has no id to resume, so a reload drops it
      partialize: ({ state }) => ({
        state: state.phase === 'starting' ? { phase: 'idle' } : state,
      }),
    },
  ),
);
