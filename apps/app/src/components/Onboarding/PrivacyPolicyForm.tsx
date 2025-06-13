import { Header3 } from '@op/ui/Header';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { StepProps } from '../MultiStepForm';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useAppForm } from '../form/utils';

export const validator = z
  .object({
    privacyPolicyAccept: z.boolean().default(true),
  })
  .default({
    privacyPolicyAccept: true,
  });

const FormalSection = ({ children }: { children: React.ReactNode }) => {
  return (
    <section className="flex flex-col gap-6 text-neutral-charcoal">
      {children}
    </section>
  );
};
export const PrivacyPolicyForm = ({
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
        <FormHeader text={t('Privacy Policy')}></FormHeader>
        <span className="text-neutral-charcoal">
          {t('Effective Date: March 15, 2025')}
        </span>
        <div className="relative flex w-full flex-col gap-8 sm:pb-20">
          <FormalSection>
            <Header3 className="font-serif"> 1. Introduction</Header3>
            <p>
              Welcome to Common Network. These Terms of Service ("Terms") govern
              your access to and use of the Common Network platform, including
              our website, mobile applications, and services (collectively, the
              "Service"). By accessing or using the Service, you agree to be
              bound by these Terms. If you do not agree to these Terms, you may
              not access or use the Service.
            </p>
          </FormalSection>
          <FormalSection>
            <Header3 className="font-serif"> 2. About Common Network</Header3>
            <p>PLACEHOLDER SO WE DON"T THINK THIS IS REAL AND SHIP IT</p>
          </FormalSection>
          <FormalSection>
            <Header3 className="font-serif">3. Account Registration</Header3>

            <Header3 className="font-serif text-sm">3.1 Eligibility</Header3>
            <p>PLACEHOLDER.</p>
          </FormalSection>
          <FormalSection>
            <Header3 className="font-serif text-sm">
              3.2 Account Information
            </Header3>
            <p>PLACEHOLDER.</p>
          </FormalSection>
        </div>

        <div className="flex flex-col-reverse justify-between gap-4 sm:flex-row sm:gap-2">
          <form.Button color="secondary" onPress={onBack}>
            {t('Back')}
          </form.Button>
          <form.SubmitButton>{t('Continue')}</form.SubmitButton>
        </div>
      </FormContainer>
    </form>
  );
};
