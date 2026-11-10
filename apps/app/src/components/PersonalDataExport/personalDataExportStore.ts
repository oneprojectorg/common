import { PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS } from '@op/common/client';
import { create } from 'zustand';
import type { StateStorage } from 'zustand/middleware';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Longest the client waits for one personal data export.
 *
 * The run collects and uploads in a single step, so it reports `processing` once
 * and then nothing until it settles. Silence is normal for a large account, and
 * only this total ends the wait.
 */
export const PERSONAL_DATA_EXPORT_MAX_WAIT_MS = 30 * 60 * 1000;

/**
 * How long a finished export stays offered before the row returns to "Download"
 * so the user can start a fresh one. The workflow deletes the file on the same
 * clock, so `readyAt` is the server's completion time: the offer is withdrawn
 * before the file goes.
 */
export const PERSONAL_DATA_EXPORT_READY_TTL_MS =
  PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS;

/** The ready toast's id, so a newer run can close an older run's offer. */
export const PERSONAL_DATA_EXPORT_READY_TOAST_ID = 'personal-data-export-ready';

export type PersonalDataExportState =
  | { phase: 'idle' }
  // the start request is in flight and there is no id yet
  | { phase: 'starting' }
  | { phase: 'running'; exportId: string; startedAt: number }
  // The file exists. Its link is read when the user asks for it, because a
  // signed URL expires and the server re-signs a stale one on read.
  | { phase: 'ready'; exportId: string; isPartial: boolean; readyAt: number };

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
  complete: (
    exportId: string,
    result: { isPartial: boolean; readyAt: number },
  ) => boolean;
  /** Returns to idle. False when that run is not the current one. */
  reset: (exportId: string) => boolean;
  /** Drops whatever run is held, for a sign-out. */
  clear: () => void;
}

// Outside React so a run outlives the settings modal and every page header, and
// in session storage so it outlives a reload. Session rather than local storage
// keeps it to one tab, and PersonalDataExportWatcher clears it on sign-out so
// it never passes to the next user of that tab.
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
      complete: (exportId, { isPartial, readyAt }) => {
        const { state } = get();
        if (state.phase !== 'running' || state.exportId !== exportId) {
          return false;
        }
        set({
          state: { phase: 'ready', exportId, isPartial, readyAt },
        });
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
      clear: () => set({ state: { phase: 'idle' } }),
    }),
    {
      name: 'personal-data-export',
      storage: createJSONStorage(() => sessionStorageOrMemory),
      skipHydration: true,
      // a start in flight has no id to resume, so a reload drops it
      partialize: ({ state }) => ({
        state: state.phase === 'starting' ? { phase: 'idle' } : state,
      }),
    },
  ),
);

// Session storage, or nothing when the browser blocks it or there is no window.
//
// `persist` must always get a storage. Given none, Zustand builds the store
// without its `persist` API, and the watcher's `rehydrate()` call in the locale
// layout would then throw on every page. Each call is guarded rather than
// probed once, because access can fail at any time (blocked site data, a full
// quota). The run then lives in memory only and is lost on reload.
const sessionStorageOrMemory: StateStorage = {
  getItem: (name) => {
    try {
      return window.sessionStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.sessionStorage.setItem(name, value);
    } catch {
      // keep the run in memory
    }
  },
  removeItem: (name) => {
    try {
      window.sessionStorage.removeItem(name);
    } catch {
      // nothing stored to remove
    }
  },
};
