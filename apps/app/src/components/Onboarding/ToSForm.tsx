import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import type { StepProps } from '../MultiStepForm';
import { ToSContent } from '../ToSContent';
import { ToSContentShort } from '../ToSContent/ToSContentShort';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useAppForm } from '../form/utils';

export const validator = z
  .object({
    tosAccept: z.boolean().default(true),
  })
  .default({
    tosAccept: true,
  });

export const ToSForm = ({
  onNext,
  onBack,
  className,
}: StepProps & { className?: string }) => {
  const t = useTranslations();
  const form = useAppForm({
    validators: {
      onChange: validator,
    },
    onSubmit: () => {
      onNext({});
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className={className}
    >
      <FormContainer className="max-w-[32rem]">
        <FormHeader text={t('Terms of Service Overview')}></FormHeader>
        <span className="text-neutral-charcoal">
          {t('Effective Date: March 15, 2025')}
        </span>

        <ToSContentShort />
        <div className="flex flex-col-reverse justify-between gap-4 pb-12 sm:flex-row sm:gap-2">
          <form.Button color="secondary" onPress={onBack}>
            {t('Back')}
          </form.Button>
          <form.SubmitButton>{t('Accept & Continue')}</form.SubmitButton>
        </div>

        <FormHeader text={t('Terms of Service')}></FormHeader>
        <ToSContent />

        <div className="flex flex-col-reverse justify-between gap-4 sm:flex-row sm:gap-2">
          <form.Button color="secondary" onPress={onBack}>
            {t('Back')}
          </form.Button>
          <form.SubmitButton>{t('Accept & Continue')}</form.SubmitButton>
        </div>
      </FormContainer>
    </form>
  );
};
