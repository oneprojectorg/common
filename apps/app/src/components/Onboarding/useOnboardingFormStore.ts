import { logger } from '@op/logging/client';
import { create } from 'zustand';
import type { StateStorage } from 'zustand/middleware';
import { createJSONStorage, persist } from 'zustand/middleware';

// The image uploaders stash a base64 `data:` URL into form state for an instant
// preview before the real upload URL comes back. Those blobs must never reach
// sessionStorage — two of them overflow the ~5MB quota and the write throws
// QuotaExceededError, breaking onboarding. Drop them from the persisted copy;
// the real (http) URLs that replace them are small and stay.
// Matches only base64 data URLs (`data:<mime>;base64,...`) so a free-text field
// that merely starts with "data:" (e.g. a headline) is left untouched.
const BASE64_DATA_URL = /^data:[^,]*;base64,/;

const stripBase64DataUrls = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return BASE64_DATA_URL.test(value) ? undefined : value;
  }
  if (Array.isArray(value)) {
    return value.map(stripBase64DataUrls);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        stripBase64DataUrls(entry),
      ]),
    );
  }
  return value;
};

// Every access is guarded so a quota overflow or a browser where storage is
// disabled (private mode, blocked cookies, SSR) degrades gracefully — the form
// keeps working in memory instead of throwing an unhandled error.
const createSafeStorage = (getStorage: () => Storage): StateStorage => ({
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
      logger.warn('Failed to persist onboarding form state', { error });
    }
  },
  removeItem: (name) => {
    try {
      getStorage().removeItem(name);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  },
});

interface OnboardingFormState {
  step: number;
  personalDetails?: any;
  organizationDetails?: any;
  fundingInformation?: any;
  privacyPolicy?: any;
  tos?: any;
  error: string | null;
  setStep: (step: number) => void;
  setPersonalDetails: (data: any) => void;
  setOrganizationDetails: (data: any) => void;
  setFundingInformation: (data: any) => void;
  setPrivacyPolicy: (data: any) => void;
  setTos: (data: any) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useOnboardingFormStore = create<OnboardingFormState>()(
  persist(
    (set) => ({
      step: 0,
      matchingOrganizations: undefined,
      personalDetails: undefined,
      organizationDetails: undefined,
      fundingInformation: undefined,
      privacyPolicy: undefined,
      tos: undefined,
      error: null,
      setStep: (step) => set({ step }),
      setPersonalDetails: (data) => set({ personalDetails: data }),
      setOrganizationDetails: (data) => set({ organizationDetails: data }),
      setFundingInformation: (data) => set({ fundingInformation: data }),
      setPrivacyPolicy: (data) => set({ privacyPolicy: data }),
      setTos: (data) => set({ tos: data }),
      setError: (error) => set({ error }),
      reset: () =>
        set({
          step: 0,
          personalDetails: undefined,
          organizationDetails: undefined,
          fundingInformation: undefined,
          privacyPolicy: undefined,
          tos: undefined,
          error: null,
        }),
    }),
    {
      name: 'onboarding-form',
      storage: createJSONStorage(() => createSafeStorage(() => sessionStorage)),
      partialize: (state) =>
        stripBase64DataUrls({
          step: state.step,
          personalDetails: state.personalDetails,
          organizationDetails: state.organizationDetails,
          fundingInformation: state.fundingInformation,
          privacyPolicy: state.privacyPolicy,
          tos: state.tos,
          error: state.error,
        }) as Partial<OnboardingFormState>,
    },
  ),
);
