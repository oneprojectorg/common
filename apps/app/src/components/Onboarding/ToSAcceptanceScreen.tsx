'use client';

import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import { FieldLabel } from '@op/sense/Field';
import { ReactNode, useId, useRef, useState } from 'react';

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
          <Button
            className="w-full"
            disabled={!canSubmit}
            loading={isSubmitting}
            onClick={onAccept}
          >
            {t('Join Common')}
          </Button>

          <Button
            className="w-full"
            variant="outline"
            onClick={onGoBack}
            disabled={isSubmitting}
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
  const checkboxId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex items-center gap-1">
      <Checkbox
        id={checkboxId}
        checked={checked}
        onCheckedChange={(value) => onChange(value)}
      />
      <FieldLabel htmlFor={checkboxId} className="text-sm">
        {t('I accept the')}
      </FieldLabel>
      <Dialog>
        <DialogTrigger
          render={
            <Button variant="link" size="inline" className="text-sm">
              {label}
            </Button>
          }
        />
        {/* shadcn scrollable-dialog pattern (matches SiteHeader LegalDialogs):
            fixed header, scrollable body. `initialFocus` lands on the scroll
            container (top) instead of the first link in the legal text, which
            otherwise opens the dialog scrolled partway down. */}
        <DialogContent className="p-0 sm:max-w-xl" initialFocus={scrollRef}>
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          <div
            ref={scrollRef}
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto px-6 py-4 outline-none"
          >
            {modalContent}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
