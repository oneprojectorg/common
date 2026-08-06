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
import { useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { useAppForm } from '@/components/form/utils';

export const WaitlistSignup = () => {
  const t = useTranslations();
  const [isSubmitted, setIsSubmitted] = useState(false);
  return (
    <Dialog>
      <DialogTrigger render={<Button>{t('Join the waitlist')}</Button>} />
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
    firstName: z.string().min(1, t('Please enter your first name')),
    lastName: z.string().min(1, t('Please enter your last name')),
    email: z.email({ error: t('Please enter a valid email address') }),
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
            description: t(
              'We were not able to sign you up. Please try again.',
            ),
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
          {t('Common')}
        </DialogTitle>
      </div>
      <p className="px-8 text-center">
        {t(
          "Get early access. We're getting ready to welcome more organizations to Common. Sign up now to hold your spot.",
        )}
      </p>
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
              label={t('First name')}
              isRequired
              placeholder={t('First name here')}
            />
          )}
        />
        <form.AppField
          name="lastName"
          children={(field) => (
            <field.TextField
              label={t('Last name')}
              isRequired
              placeholder={t('Last name here')}
            />
          )}
        />
        <form.AppField
          name="email"
          children={(field) => (
            <field.TextField
              label={t('Email address')}
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
              placeholder={t('Organization name')}
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
              {t('Join the waitlist')}
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
      <div className="px-6 pt-16">
        <DialogTitle className="w-full text-center font-serif text-xl font-extralight tracking-tight sm:text-2xl">
          {t("You're on the list!")}
        </DialogTitle>
      </div>
      <div className="flex flex-col items-center gap-6 p-8 text-center">
        <p>
          {t(
            "We can't wait to see you on Common, as an early collaborator in creating an economy that works for everyone.",
          )}
        </p>
        <p>{t("We'll be in touch soon!")}</p>
        <DialogClose render={<Button variant="secondary" className="w-9/10" />}>
          {t('Done')}
        </DialogClose>
      </div>
    </>
  );
};
