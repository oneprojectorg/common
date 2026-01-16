'use client';

import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface CreateDecisionFromTemplateModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const CreateDecisionFromTemplateModal = ({
  isOpen,
  onOpenChange,
}: CreateDecisionFromTemplateModalProps) => {
  const router = useRouter();
  const utils = trpc.useUtils();
  const isOnline = useConnectionStatus();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();

  // Fetch available templates
  const { data: templatesData, isLoading: isLoadingTemplates } =
    trpc.decision.listProcesses.useQuery(
      {},
      {
        enabled: isOpen,
      },
    );

  const createFromTemplate =
    trpc.decision.createInstanceFromTemplate.useMutation({
      onSuccess: (result) => {
        toast.success({
          title: 'Decision created',
          message: 'Your decision process has been created successfully.',
        });

        // Invalidate decision lists
        utils.decision.listInstances.invalidate();
        utils.decision.listDecisionProfiles.invalidate();

        // Reset form and close modal
        resetForm();
        onOpenChange(false);

        // Navigate to the new decision
        if (result.slug) {
          router.push(`/d/${result.slug}`);
        }
      },
      onError: (error) => {
        const errorInfo = analyzeError(error);
        if (errorInfo.isConnectionError) {
          toast.error({
            title: 'Connection issue',
            message: 'Please check your internet connection and try again.',
          });
        } else {
          toast.error({
            title: 'Failed to create decision',
            message: errorInfo.message,
          });
        }
      },
    });

  const resetForm = () => {
    setSelectedTemplateId(null);
    setName('');
    setDescription('');
    setNameError(undefined);
  };

  const handleSubmit = () => {
    // Validate
    if (!name || name.length < 3) {
      setNameError('Name must be at least 3 characters');
      return;
    }

    if (!selectedTemplateId) {
      toast.error({
        title: 'Template required',
        message: 'Please select a template to create your decision.',
      });
      return;
    }

    if (!isOnline) {
      toast.error({
        title: 'No connection',
        message: 'Please check your internet connection and try again.',
      });
      return;
    }

    if (createFromTemplate.isPending) {
      return;
    }

    createFromTemplate.mutate({
      templateId: selectedTemplateId,
      name,
      description: description || undefined,
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const templates = templatesData?.processes ?? [];

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange} isDismissable>
      <ModalHeader>Create Decision</ModalHeader>
      <ModalBody className="flex flex-col gap-4">
        {isLoadingTemplates ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : templates.length === 0 ? (
          <p className="py-4 text-center text-neutral-gray4">
            No templates available
          </p>
        ) : (
          <>
            <Select
              label="Template"
              placeholder="Select a template"
              selectedKey={selectedTemplateId}
              onSelectionChange={(key) =>
                setSelectedTemplateId(key as string | null)
              }
              isRequired
            >
              {templates.map((template) => (
                <SelectItem key={template.id} id={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </Select>

            <TextField
              label="Name"
              value={name}
              onChange={setName}
              errorMessage={nameError}
              isRequired
              inputProps={{
                placeholder: 'Enter decision name',
              }}
            />

            <TextField
              label="Description"
              value={description}
              onChange={setDescription}
              useTextArea
              textareaProps={{
                placeholder: 'Enter a description (optional)',
                rows: 3,
              }}
            />
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onPress={() => handleOpenChange(false)}>
          Cancel
        </Button>
        <Button
          color="primary"
          onPress={handleSubmit}
          isDisabled={
            isLoadingTemplates ||
            templates.length === 0 ||
            createFromTemplate.isPending
          }
        >
          {createFromTemplate.isPending ? (
            <LoadingSpinner className="size-4" />
          ) : (
            'Create'
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
