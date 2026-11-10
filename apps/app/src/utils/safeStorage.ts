import { logger } from '@op/logging/client';
import type { StateStorage } from 'zustand/middleware';

// A `persist` storage that falls back to memory when the browser blocks
// storage, is over quota, or there is no window.
export const createSafeStorage = (getStorage: () => Storage): StateStorage => ({
  getItem: (name) => {
    try {
      return getStorage().getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      getStorage().setItem(name, value);
    } catch (error) {
      logger.warn('Failed to persist store state', { name, error });
    }
  },
  removeItem: (name) => {
    try {
      getStorage().removeItem(name);
    } catch {
      // nothing to remove
    }
  },
});
