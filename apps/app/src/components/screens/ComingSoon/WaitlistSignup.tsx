'use client';

import { Button } from '@op/ui/Button';
import { IconButton } from '@op/ui/IconButton';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { toast } from '@op/ui/Toast';
import { useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from 'react-aria-components';
import { LuX } from 'react-icons/lu';
import { tv } from 'tailwind-variants';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { getFieldErrorMessage, useAppForm } from '@/components/form/utils';

const overlayStyles = tv({
  base: 'absolute top-0 left-0 isolate z-20 h-(--page-height) w-full bg-black/10 text-center backdrop-blur-[3px]',
  variants: {
    isEntering: {
      true: 'animate-in duration-200 ease-out fade-in',
    },
    isExiting: {
      true: 'animate-out duration-200 ease-in fade-out',
    },
  },
});

const modalStyles = tv({
  base: 'max-h-[calc(var(--visual-viewport-height)*.9)] w-full max-w-[min(90vw,450px)] rounded-2xl border border-black/10 bg-white bg-clip-padding text-left align-middle font-sans text-neutral-700 shadow dark:border-white/10 dark:bg-neutral-800/70 dark:text-neutral-300 dark:backdrop-blur-2xl dark:backdrop-saturate-200 forced-colors:bg-[Canvas]',
  variants: {
    isEntering: {
      true: 'animate-in duration-200 ease-out zoom-in-105',
    },
    isExiting: {
      true: 'animate-out duration-200 ease-in zoom-out-95',
    },
  },
});
export const WaitlistSignup = () => {
  const t = useTranslations();
  const [isSubmitted, setIsSubmitted] = useState(false);
  return (
    <DialogTrigger>
      <Button>{t('Decide with us')}</Button>
      <ModalOverlay isDismissable className={overlayStyles}>
        <div className="sticky top-0 left-0 box-border flex h-(--visual-viewport-height) w-full items-center justify-center">
          <Modal isDismissable className={modalStyles}>
            <Dialog className="relative max-h-[inherit] overflow-auto">
              {isSubmitted ? (
                <WaitlistSignupSuccess />
              ) : (
                <WaitlistSignupForm onSuccess={() => setIsSubmitted(true)} />
              )}
            </Dialog>
          </Modal>
        </div>
      </ModalOverlay>
    </DialogTrigger>
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
          console.error(await res.json());
          toast.error({
            title: t('Something went wrong'),
            message: t('We were not able to sign you up. Please try again.'),
          });
          return;
        }
      },
      onSubmit: validator,
    },
  });

  return (
    <>
      <div className="relative p-6 pt-10">
        <Heading
          className="w-full bg-blueGreen bg-clip-text text-center font-serif text-xl font-extralight tracking-tight text-transparent italic sm:text-2xl"
          slot="title"
        >
          {t('Common')}
        </Heading>
        <IconButton
          className="absolute top-3 right-3 size-8 text-neutral-gray3"
          slot="close"
        >
          <LuX className="size-6" />
        </IconButton>
      </div>
      <p className="px-8 text-center">
        {t(
          "Get early access. We're getting ready to welcome more organizations to Common. Sign up now to hold your spot.",
        )}
      </p>
      <form
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
              id="firstName"
              label={t('First name')}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              isRequired
              inputProps={{
                placeholder: t('First name here'),
              }}
            />
          )}
        />
        <form.AppField
          name="lastName"
          children={(field) => (
            <field.TextField
              id="lastName"
              label={t('Last name')}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              isRequired
              inputProps={{
                placeholder: t('Last name here'),
              }}
            />
          )}
        />
        <form.AppField
          name="email"
          children={(field) => (
            <field.TextField
              id="email"
              label={t('Email address')}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              isRequired
              inputProps={{
                placeholder: 'mail@example.com',
              }}
            />
          )}
        />
        <form.AppField
          name="organizationName"
          children={(field) => (
            <field.TextField
              id="organizationName"
              label={t('Organization')}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              inputProps={{
                placeholder: t('Organization name'),
              }}
            />
          )}
        />

        <form.Subscribe selector={(formState) => [formState.isSubmitting]}>
          {([isSubmitting]) => (
            <form.SubmitButton
              className="w-auto sm:w-auto"
              isDisabled={isSubmitting}
            >
              {isSubmitting ? <LoadingSpinner /> : t('Join the waitlist')}
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
      <div className="relative px-6 pt-16">
        <Heading
          className="w-full text-center font-serif text-xl font-extralight tracking-tight sm:text-2xl"
          slot="title"
        >
          {t("You're on the list!")}
        </Heading>
        <IconButton
          className="absolute top-3 left-3 size-8 text-neutral-gray3"
          slot="close"
        >
          <LuX className="size-6" />
        </IconButton>
      </div>
      <div className="flex flex-col items-center gap-6 p-8 text-center">
        <p>
          {t(
            "We can't wait to see you on Common, as an early collaborator in creating an economy that works for everyone.",
          )}
        </p>
        <p>{t("We'll be in touch soon!")}</p>
        <Button color="secondary" className="w-9/10" slot="close">
          {t('Done')}
        </Button>
      </div>
    </>
  );
};
