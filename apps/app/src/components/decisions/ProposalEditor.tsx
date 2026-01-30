'use client';

import { useTiptapCollab } from '@/hooks/useTiptapCollab';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import {
  type ProcessInstance,
  ProposalStatus,
  type proposalEncoder,
} from '@op/api/encoders';
import { type ProposalDataInput, parseProposalData } from '@op/common/client';
import { RichTextEditorSkeleton } from '@op/ui/RichTextEditor';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import Form from '@rjsf/core';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { useRouter } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { CollaborativePresence } from '../RichTextEditor';
import {
  type CollaborativeFormContext,
  CollaborativeRichTextWidget,
} from '../experimental/CollaborativeRichTextWidget';
import { CollaborativeTextWidget } from '../experimental/CollaborativeTextWidget';
import { ProposalInfoModal } from './ProposalInfoModal';
import { ProposalEditorLayout } from './layout';

type Proposal = z.infer<typeof proposalEncoder>;

/**
 * Hardcoded proposal schema with summary and description fields.
 */
const PROPOSAL_SCHEMA: RJSFSchema = {
  type: 'object',
  required: ['summary', 'description'],
  properties: {
    summary: {
      type: 'string',
      title: 'Summary',
      description: 'A brief summary of your proposal',
      maxLength: 500,
    },
    description: {
      type: 'string',
      title: 'Description',
      description: 'Full description of your proposal',
    },
  },
};

const PROPOSAL_UI_SCHEMA: UiSchema = {
  summary: {
    'ui:widget': 'CollaborativeText',
    'ui:placeholder': 'Enter a brief summary of your proposal...',
    'ui:options': {
      field: 'summary', // Separate Y.XmlFragment for summary
    },
  },
  description: {
    'ui:widget': 'CollaborativeRichText',
    'ui:placeholder': 'Write your full proposal description here...',
    'ui:options': {
      // Use default fragment for backward compatibility with existing docs
      field: 'default',
      className: 'min-h-96',
    },
  },
};

interface ProposalFormData {
  summary?: string;
  description?: string;
}

/** Handles tRPC validation errors from mutation responses */
function handleMutationError(
  error: { data?: unknown; message?: string },
  operationType: 'create' | 'update' | 'submit',
) {
  console.error(`Failed to ${operationType} proposal:`, error);

  const errorData = error.data as
    | { cause?: { fieldErrors?: Record<string, string> } }
    | undefined;

  if (errorData?.cause?.fieldErrors) {
    const fieldErrors = errorData.cause.fieldErrors;
    const errorMessages = Object.values(fieldErrors);

    if (errorMessages.length === 1) {
      toast.error({ message: errorMessages[0] });
    } else {
      toast.error({
        title: 'Please fix the following issues:',
        message: errorMessages.join(', '),
      });
    }
  } else {
    toast.error({
      title: `Failed to ${operationType} proposal`,
      message: error.message || 'An unexpected error occurred',
    });
  }
}

/**
 * RJSF Field Template with hr separator between fields
 */
function FieldTemplate({
  children,
  id,
}: {
  children: React.ReactNode;
  id: string;
}) {
  const isFirstField = id === 'root_summary';
  return (
    <div className="mb-6">
      {!isFirstField && <hr className="mb-6 border-t border-neutral-gray2" />}
      {children}
    </div>
  );
}

/**
 * RJSF Object Field Template
 */
function ObjectFieldTemplate({
  properties,
}: {
  properties: { content: React.ReactNode }[];
}) {
  return (
    <div className="space-y-2">{properties.map((prop) => prop.content)}</div>
  );
}

/**
 * Custom textarea widget that matches our design system
 */
function TextareaWidget({
  value,
  onChange,
  schema,
  uiSchema,
  required,
}: {
  value?: string;
  onChange: (value: string) => void;
  schema: { title?: string; description?: string };
  uiSchema?: { 'ui:placeholder'?: string };
  required?: boolean;
}) {
  return (
    <TextField
      label={schema.title}
      description={schema.description}
      value={value || ''}
      onChange={onChange}
      isRequired={required}
      useTextArea
      textareaProps={{
        placeholder: uiSchema?.['ui:placeholder'],
        rows: 3,
      }}
    />
  );
}

const CustomTemplates = {
  FieldTemplate,
  ObjectFieldTemplate,
};

const CustomWidgets = {
  textarea: TextareaWidget,
  CollaborativeRichText: CollaborativeRichTextWidget,
  CollaborativeText: CollaborativeTextWidget,
};

export function ProposalEditor({
  instance,
  backHref,
  existingProposal,
  isEditMode = false,
}: {
  instance: ProcessInstance;
  backHref: string;
  existingProposal?: Proposal;
  isEditMode?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations();
  const posthog = usePostHog();
  const utils = trpc.useUtils();
  const { user } = useUser();

  // Form state
  const [title, setTitle] = useState('');
  const [formData, setFormData] = useState<ProposalFormData>({});
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs
  const initializedRef = useRef(false);

  // Check if editing a draft
  const isDraft =
    isEditMode && existingProposal?.status === ProposalStatus.DRAFT;

  const collaborationDocId = useMemo(() => {
    const { collaborationDocId: existingId } = parseProposalData(
      existingProposal?.proposalData,
    );
    if (existingId) {
      return existingId;
    }
    return `proposal-${instance.id}-${existingProposal?.id ?? crypto.randomUUID()}`;
  }, [existingProposal?.proposalData, existingProposal?.id, instance.id]);

  // Initialize TipTap collaboration
  const { ydoc, provider, status, isSynced } = useTiptapCollab({
    docId: collaborationDocId,
    enabled: true,
    userName: user.profile?.name ?? 'Anonymous',
  });

  // Form context for collaborative widgets
  const formContext = useMemo<CollaborativeFormContext | undefined>(() => {
    if (!ydoc || !provider) {
      return undefined;
    }
    return { ydoc, provider, userName: user.profile?.name };
  }, [ydoc, provider, user.profile?.name]);

  // Extract template data from the instance
  const proposalInfoTitle = instance.instanceData?.fieldValues
    ?.proposalInfoTitle as string | undefined;
  const proposalInfoContent = instance.instanceData?.fieldValues
    ?.proposalInfoContent as string | undefined;

  // Parse existing proposal data for editing
  const parsedProposalData = useMemo(
    () =>
      isEditMode && existingProposal
        ? parseProposalData(existingProposal.proposalData)
        : null,
    [isEditMode, existingProposal],
  );

  // Mutations
  const submitProposalMutation = trpc.decision.submitProposal.useMutation({
    onSuccess: async () => {
      posthog?.capture('submit_proposal_success', {
        process_instance_id: instance.id,
        process_name: instance.process?.name,
      });
      await utils.decision.listProposals.invalidate({
        processInstanceId: instance.id,
      });
      router.push(backHref);
    },
    onError: (error) => handleMutationError(error, 'submit'),
  });

  const updateProposalMutation = trpc.decision.updateProposal.useMutation({
    onSuccess: async () => {
      await utils.decision.getProposal.invalidate({
        profileId: existingProposal?.profileId,
      });
      await utils.decision.listProposals.invalidate({
        processInstanceId: instance.id,
      });
      router.push(backHref);
    },
    onError: (error) => handleMutationError(error, 'update'),
  });

  // Initialize form with existing proposal data
  useEffect(() => {
    if (
      isEditMode &&
      existingProposal &&
      parsedProposalData &&
      !initializedRef.current
    ) {
      const { title: existingTitle } = parsedProposalData;

      if (existingTitle) {
        setTitle(existingTitle);
      }

      // Initialize form data from existing proposal
      // Note: summary is a new field, description already exists
      setFormData({
        summary:
          ((parsedProposalData as Record<string, unknown>).summary as string) ||
          '',
        description: parsedProposalData.description || '',
      });

      initializedRef.current = true;
    }
  }, [isEditMode, existingProposal, parsedProposalData]);

  // Show info modal for new proposals or drafts
  useEffect(() => {
    if ((!isEditMode || isDraft) && proposalInfoTitle && proposalInfoContent) {
      setShowInfoModal(true);
    }
  }, [isEditMode, isDraft, proposalInfoTitle, proposalInfoContent]);

  const handleCloseInfoModal = useCallback(() => {
    setShowInfoModal(false);
  }, []);

  const handleFormChange = useCallback(
    ({ formData: newFormData }: { formData?: ProposalFormData }) => {
      if (newFormData) {
        setFormData(newFormData);
      }
    },
    [],
  );

  const handleSubmitProposal = useCallback(async () => {
    // Validate required fields
    const missingFields: string[] = [];

    if (!title || title.trim() === '') {
      missingFields.push(t('Title'));
    }

    if (!formData.summary?.trim()) {
      missingFields.push(t('Summary'));
    }

    // Check for empty description content
    const descriptionHtml = formData.description || '';
    const hasDescription =
      descriptionHtml.replace(/<[^>]*>/g, '').trim().length > 0;
    if (!hasDescription) {
      missingFields.push(t('Description'));
    }

    if (missingFields.length > 0) {
      toast.error({
        title: t('Please complete the following required fields:'),
        message: missingFields.join(', '),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (!existingProposal) {
        throw new Error('No proposal to update');
      }

      const proposalData: ProposalDataInput = {
        ...parseProposalData(existingProposal.proposalData),
        collaborationDocId,
        title,
        summary: formData.summary,
        description: formData.description,
      };

      // Update existing proposal
      await updateProposalMutation.mutateAsync({
        proposalId: existingProposal.id,
        data: { proposalData },
      });

      // If draft, also submit (transition to submitted status)
      if (isDraft) {
        await submitProposalMutation.mutateAsync({
          proposalId: existingProposal.id,
        });
      }
    } catch (error) {
      console.error('Failed to update proposal:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    t,
    title,
    formData,
    collaborationDocId,
    existingProposal,
    isDraft,
    submitProposalMutation,
    updateProposalMutation,
  ]);

  // Show loading state while connecting
  if (!provider || status === 'connecting') {
    return (
      <ProposalEditorLayout
        backHref={backHref}
        title={title}
        onSubmitProposal={handleSubmitProposal}
        isSubmitting={isSubmitting}
        isEditMode={isEditMode}
        isDraft={isDraft}
        presenceSlot={null}
      >
        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            <span className="text-sm text-neutral-gray4">
              {t('Connecting to collaboration server...')}
            </span>
          </div>
          <RichTextEditorSkeleton />
        </div>
      </ProposalEditorLayout>
    );
  }

  return (
    <ProposalEditorLayout
      backHref={backHref}
      title={title}
      onSubmitProposal={handleSubmitProposal}
      isSubmitting={isSubmitting}
      isEditMode={isEditMode}
      isDraft={isDraft}
      presenceSlot={<CollaborativePresence provider={provider} />}
    >
      <div className="flex flex-1 flex-col gap-8">
        {/* Connection status */}
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              status === 'connected' ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-neutral-gray4">
            {status === 'connected'
              ? isSynced
                ? t('Synced')
                : t('Syncing...')
              : t('Disconnected')}
          </span>
        </div>

        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          {/* Title */}
          <TextField
            type="text"
            value={title}
            onChange={setTitle}
            inputProps={{
              placeholder: 'Untitled Proposal',
              className: 'border-0 p-0 font-serif text-title-lg',
            }}
          />

          {/* RJSF Form with Summary and Description */}
          <Form<ProposalFormData>
            schema={PROPOSAL_SCHEMA}
            uiSchema={PROPOSAL_UI_SCHEMA}
            formData={formData}
            formContext={formContext}
            onChange={handleFormChange}
            validator={validator}
            widgets={CustomWidgets}
            templates={CustomTemplates}
            showErrorList={false}
            liveValidate={false}
            noHtml5Validate
          >
            {/* Hide default submit button */}
            <div />
          </Form>
        </div>
      </div>

      {/* Proposal Info Modal */}
      {proposalInfoTitle && proposalInfoContent && (
        <ProposalInfoModal
          isOpen={showInfoModal}
          onClose={handleCloseInfoModal}
          title={proposalInfoTitle}
          content={proposalInfoContent}
        />
      )}
    </ProposalEditorLayout>
  );
}
