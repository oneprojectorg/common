import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface OnboardingFormState {
  step: number;
  lastStep?: number;
  personalDetails?: any;
  organizationDetails?: any;
  fundingInformation?: any;
  privacyPolicy?: any;
  selectedOrganizations?: any;
  rolesAtOrganizations?: any;
  policies?: any;
  tos?: any;
  error: string | null;
  setStep: (step: number) => void;
  setLastStep: (lastStep: number) => void;
  setPersonalDetails: (data: any) => void;
  setOrganizationDetails: (data: any) => void;
  setSelectedOrganizations: (data: any) => void;
  setRolesAtOrganizations: (data: any) => void;
  setPolicies: (data: any) => void;
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
      lastStep: undefined,
      matchingOrganizations: undefined,
      selectedOrganizations: [],
      rolesAtOrganizations: [],
      policies: undefined,
      personalDetails: undefined,
      organizationDetails: undefined,
      fundingInformation: undefined,
      privacyPolicy: undefined,
      tos: undefined,
      error: null,
      setStep: (step) => set({ step }),
      setLastStep: (lastStep) => set({ lastStep }),
      setPersonalDetails: (data) => set({ personalDetails: data }),
      setOrganizationDetails: (data) => set({ organizationDetails: data }),
      setSelectedOrganizations: (data) => set({ selectedOrganizations: data }),
      setRolesAtOrganizations: (data) => set({ rolesAtOrganizations: data }),
      setPolicies: (data) => set({ policies: data }),
      setFundingInformation: (data) => set({ fundingInformation: data }),
      setPrivacyPolicy: (data) => set({ privacyPolicy: data }),
      setTos: (data) => set({ tos: data }),
      setError: (error) => set({ error }),
      reset: () =>
        set({
          step: 0,
          lastStep: 0,
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
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
