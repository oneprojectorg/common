'use client';

import { Button } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ReactNode, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { OnboardingCenterLayout } from './OnboardingCenterLayout';

function PolicyCheckbox({
  checked,
  onChange,
  href,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  href: string;
  label: string;
}) {
  const t = useTranslations();

  return (
    <div className="flex items-center gap-1">
      <Checkbox size="small" value={'' + checked} onChange={onChange}>
        {t('I accept the')}{' '}
      </Checkbox>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary-teal hover:underline"
      >
        {label}
      </a>
    </div>
  );
}

export type ToSAcceptanceScreenProps = {
  onAccept: () => void;
  onGoBack: () => void;
  isSubmitting?: boolean;
};

export const ToSAcceptanceScreen = ({
  onAccept,
  onGoBack,
  isSubmitting,
}: ToSAcceptanceScreenProps): ReactNode => {
  const t = useTranslations();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const canSubmit = termsAccepted && privacyAccepted && !isSubmitting;

  return (
    <OnboardingCenterLayout
      title={t('One last step')}
      subtitle={t(
        'Our community shaped these policies to ensure they work for real organizations like yours. Your data stays yours, and decisions about the platform are made democratically.',
      )}
    >
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-3">
          <PolicyCheckbox
            checked={termsAccepted}
            onChange={setTermsAccepted}
            href="/info/tos"
            label={t('Terms of Service')}
          />
          <PolicyCheckbox
            checked={privacyAccepted}
            onChange={setPrivacyAccepted}
            href="/info/privacy"
            label={t('Privacy Policy')}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Button className="w-full" isDisabled={!canSubmit} onPress={onAccept}>
            {isSubmitting ? <LoadingSpinner /> : t('Join Common')}
          </Button>

          <Button
            className="w-full"
            color="neutral"
            onPress={onGoBack}
            isDisabled={isSubmitting}
          >
            {t('Go back')}
          </Button>
        </div>
      </div>
    </OnboardingCenterLayout>
  );
};
