import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { StepProps } from '../MultiStepForm';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { getFieldErrorMessage, useAppForm } from '../form/utils';

export const createValidator = (t: (key: string) => string) =>
  z.object({
    termsOfServiceAccept: z.boolean().refine((value) => value, {
      error: t('You must accept the Terms of Service'),
    }),
    privacyPolicyAccept: z.boolean().refine((value) => value, {
      error: t('You must accept the Privacy Policy'),
    }),
  });

// Fallback validator for external use
export const validator = z.object({
  termsOfServiceAccept: z.boolean().prefault(false),
  privacyPolicyAccept: z.boolean().prefault(false),
});

export const PoliciesForm = ({
  onNext,
  onBack,
  className,
}: StepProps & { className?: string }) => {
  const t = useTranslations();

  const form = useAppForm({
    defaultValues: {
      termsOfServiceAccept: false,
      privacyPolicyAccept: false,
    },
    validators: {
      onSubmit: createValidator(t) as any,
    },
    onSubmit: (values) => {
      onNext(values);
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
      <FormContainer className="max-w-lg">
        <FormHeader text={t('One last step')}>
          {t(
            'Our community shaped these policies to ensure they work for real organizations like yours. Your data stays yours, and decisions about the platform are made democratically.',
          )}
        </FormHeader>
        <div className="flex flex-col gap-4">
          <form.AppField
            name="termsOfServiceAccept"
            children={(field) => (
              <field.Checkbox
                isSelected={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                size="small"
                isRequired
                isInvalid={field.state.meta.errors.length > 0}
              >
                <div className="flex flex-col">
                  <span className="text-base">
                    {t('I accept the Terms of Service')}
                  </span>
                  {field.state.meta.errors && (
                    <span role="alert" className="text-red-500">
                      {getFieldErrorMessage(field)}
                    </span>
                  )}
                </div>
              </field.Checkbox>
            )}
          />
          <form.AppField
            name="privacyPolicyAccept"
            children={(field) => (
              <field.Checkbox
                isSelected={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                size="small"
                isRequired
                isInvalid={field.state.meta.errors.length > 0}
              >
                <div className="flex flex-col">
                  <span className="text-base">
                    {t('I accept the Privacy Policy')}
                  </span>
                  {!field.state.value && (
                    <span role="alert" className="text-red-500">
                      {getFieldErrorMessage(field)}
                    </span>
                  )}
                </div>
              </field.Checkbox>
            )}
          />
        </div>

        <div className="flex flex-col gap-4">
          <form.SubmitButton
            className="sm:w-full"
            onPress={() => form.handleSubmit()}
          >
            {t('Join Common')}
          </form.SubmitButton>
          <form.Button color="secondary" onPress={onBack} className="sm:w-full">
            {t('Go back')}
          </form.Button>
        </div>
      </FormContainer>
    </form>
  );
};
