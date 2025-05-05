import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
    (set, get) => ({
      step: 0,
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
      reset: () => set({
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
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
