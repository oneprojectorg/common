'use client';

import { trpc } from '@op/api/client';
import type { CustomForm } from '@op/api/encoders';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';

import { useTranslations } from '@/lib/i18n';

import {
  CustomFormModal,
  type CustomFormValues,
} from './proposalEditor/CustomFormModal';
import { getFormSkipCookieName, setSkipCookie } from './skipCookie';

export function PhaseEntryCustomFormModal({
  form,
  participantProfileId,
  onClose,
}: {
  form: CustomForm;
  participantProfileId: string;
  onClose: () => void;
}) {
  const t = useTranslations('decisions.proposals');
  const utils = trpc.useUtils();
  const submitForm = trpc.customForm.submit.useMutation({
    onSuccess: () => {
      onClose();
      void utils.customForm.getForProfile.invalidate({
        profileId: form.profileId,
      });
    },
    onError: (error) => {
      logger.error('Failed to submit phase entry custom form', {
        error,
        customFormId: form.id,
      });
      toast.error(t('submitFormError'));
    },
  });

  const handleModalSubmit = (values: CustomFormValues) => {
    submitForm.mutate({
      customFormId: form.id,
      profileId: participantProfileId,
      data: values,
    });
  };

  const handleModalOpenChange = (open: boolean) => {
    if (open || submitForm.isPending) {
      return;
    }
    setSkipCookie(
      getFormSkipCookieName({ formId: form.id, participantProfileId }),
    );
    onClose();
  };

  return (
    <CustomFormModal
      isOpen
      customFormId={form.id}
      schema={form.schema}
      isSubmitting={submitForm.isPending}
      onSubmit={handleModalSubmit}
      onOpenChange={handleModalOpenChange}
    />
  );
}
