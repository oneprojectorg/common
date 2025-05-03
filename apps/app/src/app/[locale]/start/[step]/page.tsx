'use client';

import { AuthWrapper } from '@/utils/AuthWrapper';
import { Button } from '@op/ui/Button';
import { z } from 'zod';

import { MultiStepForm } from '@/components/MultiStepForm';
import { OnboardingFlow } from '@/components/Onboarding';

const Step1 = ({ value = {}, onChange, onBack, onSubmit, error }: any) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit(value);
    }}
    className="space-y-4"
  >
    <div>
      <label className="mb-1 block">Name</label>
      <input
        className="w-full rounded border px-2 py-1"
        value={value.name || ''}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        placeholder="Your name"
      />
    </div>
    {error && <div className="text-red-500">{error}</div>}

    <Button type="submit">Next</Button>
  </form>
);

const Step2 = ({ value = {}, onChange, onBack, onSubmit, error }: any) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit(value);
    }}
    className="space-y-4"
  >
    <div>
      <label className="mb-1 block">Age</label>
      <input
        type="number"
        className="w-full rounded border px-2 py-1"
        value={value.age || ''}
        onChange={(e) => onChange({ ...value, age: e.target.value })}
        placeholder="Your age"
      />
    </div>
    {error && <div className="text-red-500">{error}</div>}
    <Button onPress={onBack}>Back</Button>
    <Button type="submit">Finish</Button>
  </form>
);

// Step 3 Component
const Step3 = ({ value = {}, onChange, onSubmit, onBack, error }: any) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit(value);
    }}
    className="space-y-4"
  >
    <div>
      <label className="mb-1 block">Email</label>
      <input
        type="email"
        className="w-full rounded border px-2 py-1"
        value={value.email || ''}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
        placeholder="Your email"
      />
    </div>
    {error && <div className="text-red-500">{error}</div>}

    <Button onPress={onBack}>Back</Button>
    <Button type="submit">Finish</Button>
  </form>
);

const step1Schema = z.object({
  name: z.string().min(1, 'Name is required'),
});
const step2Schema = z.object({
  age: z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z
      .number()
      .positive('Age must be a positive number')
      .refine((v) => !!v, 'Age is required'),
  ),
});
const step3Schema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
});

export default function OnboardingPage() {
  return (
    <AuthWrapper>
      <div>
        <OnboardingFlow />
      </div>
    </AuthWrapper>
  );
}
