'use client';

import { Button, UnstyledButton } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { Dialog, DialogTrigger } from '@op/ui/RAC';
import { ReactNode, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { PrivacyPolicyContent } from '@/components/PrivacyPolicyContent';
import { ToSContent } from '@/components/ToSContent';

import { OnboardingCenterLayout } from './OnboardingCenterLayout';

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
            label={t('Terms of Service')}
            modalTitle={t('Terms of Service')}
            modalContent={<ToSContent />}
          />
          <PolicyCheckbox
            checked={privacyAccepted}
            onChange={setPrivacyAccepted}
            label={t('Privacy Policy')}
            modalTitle={t('Privacy Policy')}
            modalContent={<PrivacyPolicyContent />}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Button className="w-full" isDisabled={!canSubmit} onPress={onAccept}>
            {isSubmitting ? <LoadingSpinner /> : t('Join Common')}
          </Button>

          <Button
            className="w-full"
            variant="outline"
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

// --- Private sub-components ---

function PolicyCheckbox({
  checked,
  onChange,
  label,
  modalTitle,
  modalContent,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  modalTitle: string;
  modalContent: ReactNode;
}) {
  const t = useTranslations();

  return (
    <div className="flex items-center gap-1">
      <Checkbox value={'' + checked} onChange={onChange}>
        {t('I accept the')}{' '}
      </Checkbox>
      <DialogTrigger>
        <UnstyledButton className="text-sm text-primary hover:underline">
          {label}
        </UnstyledButton>
        <Modal
          className="h-screen max-h-none w-screen max-w-none overflow-y-auto sm:h-auto sm:max-h-[75vh] sm:w-[36rem] sm:max-w-[36rem]"
          isDismissable
        >
          <Dialog>
            <ModalHeader>{modalTitle}</ModalHeader>
            <ModalBody>{modalContent}</ModalBody>
          </Dialog>
        </Modal>
      </DialogTrigger>
    </div>
  );
}
