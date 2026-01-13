'use client';

import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { toast } from '@op/ui/Toast';
import { useState } from 'react';
import { z } from 'zod';

import { getFieldErrorMessage, useAppForm } from '@/components/form/utils';

const validator = z.object({
  email: z.email({ error: 'Please enter a valid email address' }),
});

export const WaitlistSignup = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-serif text-2xl font-light tracking-tight sm:text-4xl">
          Join the waitlist
        </h2>
        <p className="sm:text-xl">We'll email you when we launch publicly.</p>
      </div>{' '}
      {isSubmitted ? (
        <WaitlistSignupSuccess />
      ) : (
        <WaitlistSignupForm onSuccess={() => setIsSubmitted(true)} />
      )}
    </div>
  );
};

const WaitlistSignupForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const form = useAppForm({
    defaultValues: { email: '' },
    validators: {
      onSubmitAsync: async ({
        value,
      }: {
        value: z.infer<typeof validator>;
      }) => {
        const res = await fetch('/api/waitlist-signup', {
          body: JSON.stringify(value),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        });

        if (res.status === 201) {
          onSuccess();
        } else {
          console.error(await res.json());
          toast.error({
            title: 'Something went wrong',
            message: 'We were not able to sign you up. Please try again.',
          });
          return;
        }
      },
      onSubmit: validator,
    },
  });

  return (
    <form
      className="flex flex-col gap-3 md:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.AppField
        name="email"
        children={(field) => (
          <field.TextField
            id="email"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={field.handleChange}
            errorMessage={getFieldErrorMessage(field)}
            isRequired
            inputProps={{
              placeholder: 'Email address',
              className:
                'w-[420px] max-w-full md:px-6 md:text-xl md:h-16 md:rounded-xl group-data-[invalid=true]:outline-4 group-data-[invalid=true]:bg-red-50 bg-white',
            }}
            fieldClassName="bg-transparent"
            errorClassName="text-base text-red-50"
          />
        )}
      />

      <form.Subscribe selector={(formState) => [formState.isSubmitting]}>
        {([isSubmitting]) => (
          <form.SubmitButton
            isDisabled={isSubmitting}
            className="w-full md:h-16 md:w-44 md:rounded-xl md:p-7 md:text-xl"
          >
            {isSubmitting ? <LoadingSpinner /> : 'Join waitlist'}
          </form.SubmitButton>
        )}
      </form.Subscribe>
    </form>
  );
};

const WaitlistSignupSuccess = () => (
  <div className="flex w-max animate-in items-center rounded bg-white/85 p-4 sm:h-16 sm:rounded-xl sm:px-6 sm:py-4">
    <p className="w-max bg-orangePurple bg-clip-text text-transparent sm:text-xl">
      You're signed up! We'll be in touch.
    </p>
  </div>
);
