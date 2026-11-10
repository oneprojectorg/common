import { create } from 'zustand';

/**
 * Longest the client waits for one personal data export.
 *
 * The run collects and uploads in a single step, so it reports `processing` once
 * and then nothing until it settles. Silence is normal for a large account, and
 * only this total ends the wait.
 */
export const PERSONAL_DATA_EXPORT_MAX_WAIT_MS = 30 * 60 * 1000;

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

// Outside React so a run outlives the settings modal and every page header.
export const usePersonalDataExportStore = create<PersonalDataExportStore>(
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
);
