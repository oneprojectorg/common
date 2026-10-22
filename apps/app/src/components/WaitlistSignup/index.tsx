'use client';

import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import { toast } from '@op/sense/Toast';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { useAppForm } from '@/components/form/utils';

export const WaitlistSignup = ({ trigger }: { trigger?: ReactElement }) => {
  const t = useTranslations();
  const [isSubmitted, setIsSubmitted] = useState(false);
  return (
    // Reset on close so reopening shows the form again. `Complete` so the
    // swap lands after the exit animation, not during it.
    <Dialog onOpenChangeComplete={(open) => !open && setIsSubmitted(false)}>
      <DialogTrigger
        render={trigger ?? <Button>{t('shell.waitlistHeading')}</Button>}
      />
      <DialogContent className="font-sans sm:max-w-md">
        {isSubmitted ? (
          <WaitlistSignupSuccess />
        ) : (
          <WaitlistSignupForm onSuccess={() => setIsSubmitted(true)} />
        )}
      </DialogContent>
    </Dialog>
  );
};

const WaitlistSignupForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const t = useTranslations();

  const validator = z.object({
    firstName: z.string().min(1, t('shell.waitlistFirstNameRequired')),
    lastName: z.string().min(1, t('shell.waitlistLastNameRequired')),
    email: z.email({ error: t('shell.waitlistEmailInvalid') }),
    organizationName: z.string(),
  });

  const form = useAppForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      organizationName: '',
    },
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
          const errorBody = await res.json();
          logger.error('Waitlist signup failed', {
            context: 'WaitlistSignup',
            response: JSON.stringify(errorBody),
          });
          toast.error(t('Something went wrong'), {
            description: t('shell.waitlistSubmitError'),
          });
          return;
        }
      },
      onChange: validator,
      onSubmit: validator,
    },
  });

  return (
    <>
      <div className="p-6 pt-10">
        <DialogTitle className="w-full bg-blueGreen bg-clip-text text-center font-serif text-xl font-extralight tracking-tight text-transparent italic sm:text-2xl">
          {t('shell.brandName')}
        </DialogTitle>
      </div>
      <p className="px-8 text-center">{t('shell.waitlistIntro')}</p>
      <form
        noValidate
        className="flex flex-col gap-6 p-8"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.AppField
          name="firstName"
          children={(field) => (
            <field.TextField
              autoFocus
              label={t('shell.firstNameLabel')}
              isRequired
              placeholder={t('shell.firstNamePlaceholder')}
            />
          )}
        />
        <form.AppField
          name="lastName"
          children={(field) => (
            <field.TextField
              label={t('shell.lastNameLabel')}
              isRequired
              placeholder={t('shell.lastNamePlaceholder')}
            />
          )}
        />
        <form.AppField
          name="email"
          children={(field) => (
            <field.TextField
              label={t('shell.emailLabel')}
              type="email"
              isRequired
              placeholder="mail@example.com"
            />
          )}
        />
        <form.AppField
          name="organizationName"
          children={(field) => (
            <field.TextField
              label={t('Organization')}
              placeholder={t('shell.organizationNameLabel')}
            />
          )}
        />

        <form.Subscribe selector={(formState) => [formState.isSubmitting]}>
          {([isSubmitting]) => (
            <form.SubmitButton
              className="w-auto sm:w-auto"
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              {t('shell.waitlistHeading')}
            </form.SubmitButton>
          )}
        </form.Subscribe>
      </form>
    </>
  );
};

const WaitlistSignupSuccess = () => {
  const t = useTranslations();
  return (
    <>
      <div className="px-6 pt-12">
        <DialogTitle className="w-full text-center font-serif text-xl font-extralight tracking-tight sm:text-2xl">
          {t('shell.waitlistSuccessTitle')}
        </DialogTitle>
      </div>
      <div className="flex flex-col items-center gap-6 p-8 text-center">
        <p>{t('shell.waitlistSuccessBody')}</p>
        <p>{t('shell.waitlistSuccessFooter')}</p>
        <DialogClose
          render={<Button variant="outline" className="mt-2 w-9/10" />}
        >
          {t('Done')}
        </DialogClose>
      </div>
    </>
  );
};
