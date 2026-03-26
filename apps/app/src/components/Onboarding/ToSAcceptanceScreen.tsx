'use client';

import { Button } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { ReactNode, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';

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
    <div className="flex w-full max-w-lg flex-col items-center">
      <FormContainer>
        <FormHeader text={t('One last step')}>
          {t(
            'Our community shaped these policies to ensure they work for real organizations like yours. Your data stays yours, and decisions about the platform are made democratically.',
          )}
        </FormHeader>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1">
              <Checkbox
                size="small"
                value={'' + termsAccepted}
                onChange={setTermsAccepted}
              >
                {t('I accept the')}{' '}
              </Checkbox>
              <a
                href="/info/tos"
                target="_blank"
                className="text-sm text-primary-teal hover:underline"
              >
                {t('Terms of Service')}
              </a>
            </div>

            <div className="flex items-center gap-1">
              <Checkbox
                size="small"
                value={'' + privacyAccepted}
                onChange={setPrivacyAccepted}
              >
                {t('I accept the')}{' '}
              </Checkbox>
              <a
                href="/info/privacy"
                target="_blank"
                className="text-sm text-primary-teal hover:underline"
              >
                {t('Privacy Policy')}
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              className="w-full"
              isDisabled={!canSubmit}
              onPress={onAccept}
            >
              {t('Join Common')}
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
      </FormContainer>
    </div>
  );
};
