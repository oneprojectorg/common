'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

export const GenerateProcessModal = ({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) => {
  const t = useTranslations();
  const router = useRouter();
  const [description, setDescription] = useState('');

  const generateProcess =
    trpc.decision.generateProcessFromDescription.useMutation({
      onSuccess: (data) => {
        onOpenChange(false);
        router.push(`/decisions/${data.slug}/edit`);
      },
      onError: (error) => {
        toast.error({
          message: t('Failed to generate template'),
          title: error.message,
        });
      },
    });

  const handleGenerate = () => {
    if (description.trim().length < 10) {
      return;
    }
    generateProcess.mutate({ description: description.trim() });
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <ModalHeader>{t('Describe your decision-making process')}</ModalHeader>
      <ModalBody className="flex flex-col gap-4">
        <p className="text-neutral-gray4">
          {t(
            "Tell us about your decision-making process and we'll create a template for you.",
          )}
        </p>
        <TextField
          useTextArea
          aria-label={t('Process description')}
          value={description}
          onChange={setDescription}
          textareaProps={{
            className: 'min-h-32 resize-y',
            placeholder: t(
              'e.g., A hiring process where candidates submit applications, a committee reviews them, then we do ranked-choice voting',
            ),
          }}
        />
      </ModalBody>
      <ModalFooter>
        <Button
          color="neutral"
          onPress={() => onOpenChange(false)}
          className="w-full sm:w-auto"
        >
          {t('Cancel')}
        </Button>
        <Button
          onPress={handleGenerate}
          isPending={generateProcess.isPending}
          isDisabled={
            generateProcess.isPending || description.trim().length < 10
          }
          className="w-full sm:w-auto"
        >
          {generateProcess.isPending
            ? t('Generating your template...')
            : t('Generate template')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
