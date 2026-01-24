'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { LuPlus, LuX } from 'react-icons/lu';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

/**
 * CreatePollDialog provides a modal form for creating new polls.
 * Features:
 * - Question input field
 * - Dynamic option list with add/remove capability
 * - Validation for minimum 2 options, maximum 10
 * - Calls polls.create mutation on submit
 */
export function CreatePollDialog({
  targetType,
  targetId,
  children,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  targetType: string;
  targetId: string;
  children?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}) {
  const t = useTranslations();
  const { user } = useUser();
  const utils = trpc.useUtils();
  const optionsLabelId = useId();

  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  const isOpen = controlledIsOpen ?? internalIsOpen;
  const setIsOpen = controlledOnOpenChange ?? setInternalIsOpen;

  const profileId = user.currentOrganization?.id;

  const createMutation = trpc.polls.create.useMutation({
    onSuccess: () => {
      utils.polls.listByTarget.invalidate({ targetType, targetId });
      toast.success({
        title: t('Poll created'),
        message: t('Your poll is now live'),
      });
      handleClose();
    },
    onError: (error) => {
      toast.error({
        title: t('Failed to create poll'),
        message: error.message,
      });
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    setQuestion('');
    setOptions(['', '']);
  };

  const handleAddOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > MIN_OPTIONS) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = () => {
    if (!profileId) {
      toast.error({
        title: t('Error'),
        message: t('No organization selected'),
      });
      return;
    }

    const trimmedQuestion = question.trim();
    const trimmedOptions = options
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    if (!trimmedQuestion) {
      toast.error({
        title: t('Validation error'),
        message: t('Please enter a question'),
      });
      return;
    }

    if (trimmedOptions.length < MIN_OPTIONS) {
      toast.error({
        title: t('Validation error'),
        message: t('Please provide at least {count} options', {
          count: MIN_OPTIONS,
        }),
      });
      return;
    }

    createMutation.mutate({
      question: trimmedQuestion,
      options: trimmedOptions,
      targetType,
      targetId,
      profileId,
    });
  };

  const canSubmit =
    question.trim().length > 0 &&
    options.filter((o) => o.trim().length > 0).length >= MIN_OPTIONS;

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      {controlledIsOpen === undefined ? children : null}
      <Modal isDismissable isOpen={isOpen} onOpenChange={setIsOpen}>
        <ModalHeader>{t('Create Poll')}</ModalHeader>
        <ModalBody className="gap-4">
          <TextField
            label={t('Question')}
            value={question}
            onChange={setQuestion}
            inputProps={{ placeholder: t('What would you like to ask?') }}
            isRequired
          />

          <fieldset className="flex flex-col gap-2">
            <legend
              id={optionsLabelId}
              className="text-sm font-medium text-neutral-charcoal"
            >
              {t('Options')}
              <span className="text-functional-red"> *</span>
            </legend>

            {options.map((option, index) => (
              <div
                key={`option-${targetId}-${index}`}
                className="flex items-center gap-2"
              >
                <TextField
                  aria-label={t('Option {number}', { number: index + 1 })}
                  value={option}
                  onChange={(value) => handleOptionChange(index, value)}
                  inputProps={{
                    placeholder: t('Option {number}', { number: index + 1 }),
                  }}
                  className="flex-1"
                />
                {options.length > MIN_OPTIONS && (
                  <Button
                    color="neutral"
                    variant="icon"
                    size="small"
                    onPress={() => handleRemoveOption(index)}
                    aria-label={t('Remove option')}
                  >
                    <LuX className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            {options.length < MAX_OPTIONS && (
              <Button
                color="secondary"
                surface="outline"
                size="small"
                onPress={handleAddOption}
                className="mt-1 self-start"
              >
                <LuPlus className="mr-1 h-4 w-4" />
                {t('Add option')}
              </Button>
            )}

            <p className="text-xs text-neutral-gray3">
              {t('{min}-{max} options allowed', {
                min: MIN_OPTIONS,
                max: MAX_OPTIONS,
              })}
            </p>
          </fieldset>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onPress={handleClose}>
            {t('Cancel')}
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isDisabled={!canSubmit || createMutation.isPending}
          >
            {createMutation.isPending ? t('Creating...') : t('Create')}
          </Button>
        </ModalFooter>
      </Modal>
    </DialogTrigger>
  );
}
