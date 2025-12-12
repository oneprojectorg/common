'use client';

import { Button } from '@op/ui/Button';
import { z } from 'zod';

import { getFieldErrorMessage, useAppForm } from '@/components/form/utils';

const validator = z.object({
  email: z.email({ error: 'Please enter a valid email address' }),
});

export const WaitlistSignupForm = () => {
  const form = useAppForm({
    defaultValues: { email: '' },
    validators: {
      onSubmitAsync: async ({
        value,
      }: {
        value: z.infer<typeof validator>;
      }) => {
        const res = await fetch('/api/waitlist-signup', {
          body: JSON.stringify({
            email: value.email,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        });

        if (res.status === 201) {
          console.log('success');
        } else {
          console.log(await res.json());
        }
      },
      onSubmit: validator,
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-serif text-2xl font-light tracking-tight sm:text-4xl">
          Join the waitlist
        </h2>
        <p className="sm:text-xl">We'll email you when we launch publicly.</p>
      </div>
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
                  'w-[420px] max-w-full md:px-6 md:text-xl md:h-16 md:rounded-xl group-data-[invalid=true]:outline-4 group-data-[invalid=true]:bg-red-50',
              }}
              fieldClassName="bg-transparent"
              errorClassName="text-base text-red-50"
            />
          )}
        />
        <Button
          type="submit"
          className="w-full md:h-16 md:w-auto md:rounded-xl md:p-7 md:text-xl"
        >
          Join waitlist
        </Button>
      </form>
    </div>
  );
};
