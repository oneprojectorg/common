'use client';

import { useTiptapCollab } from '@/hooks/useTiptapCollab';
import { Button } from '@op/ui/Button';
import { RichTextEditorSkeleton } from '@op/ui/RichTextEditor';
import { toast } from '@op/ui/Toast';
import Form from '@rjsf/core';
import type { RJSFSchema } from '@rjsf/utils';
import type { UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { useCallback, useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { CustomWidgets as BaseCustomWidgets } from '@/components/Profile/CreateDecisionProcessModal/CustomWidgets';

import {
  type CollaborativeFormContext,
  CollaborativeRichTextWidget,
} from './CollaborativeRichTextWidget';
import { CollaborativeTextWidget } from './CollaborativeTextWidget';
import { CustomTemplates } from './RJSFTemplates';
import { generateUiSchema, mergeUiSchema } from './generateUiSchema';

/**
 * Hardcoded proposal schema with summary and description fields.
 *
 * Convention:
 * - `format: "richtext"` signals a rich text field → CollaborativeRichText widget
 * - Plain string fields → CollaborativeText widget
 *
 * The uiSchema is auto-generated from this schema via generateUiSchema().
 */
const PROPOSAL_SCHEMA: RJSFSchema = {
  type: 'object',
  title: 'Proposal',
  required: ['summary', 'description'],
  properties: {
    summary: {
      type: 'string',
      title: 'Summary',
      description: 'A brief summary of your proposal (plain text)',
      maxLength: 500,
    },
    description: {
      type: 'string',
      format: 'richtext', // <-- This signals rich text widget
      title: 'Description',
      description:
        'Full description of your proposal (rich text, collaborative)',
    },
  },
};

/**
 * Manual uiSchema overrides - merged with auto-generated schema.
 * Use this for placeholders, custom classNames, etc.
 */
const PROPOSAL_UI_OVERRIDES: UiSchema = {
  summary: {
    'ui:placeholder': 'Enter a brief summary of your proposal...',
  },
  description: {
    'ui:placeholder': 'Write your full proposal description here...',
    'ui:options': {
      className: 'min-h-72',
    },
  },
};

interface RJSFProposalEditorProps {
  /** Unique document ID for collaboration (required) */
  docId: string;
  /** User's display name for collaboration cursors */
  userName?: string;
  /** Called when form is submitted with valid data */
  onSubmit?: (data: ProposalFormData) => void;
  /** Initial form data (for editing existing proposals) */
  initialData?: Partial<ProposalFormData>;
}

interface ProposalFormData {
  summary: string;
  description: string;
}

/**
 * Experimental RJSF-based proposal editor with collaborative rich text.
 * Uses a hardcoded schema with summary (textarea) and description (collaborative rich text).
 */
export function RJSFProposalEditor({
  docId,
  userName = 'Anonymous',
  onSubmit,
  initialData,
}: RJSFProposalEditorProps) {
  const t = useTranslations();
  const [formData, setFormData] = useState<Partial<ProposalFormData>>(
    initialData ?? {},
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize collaboration
  const { ydoc, provider, status, isSynced } = useTiptapCollab({
    docId,
    enabled: true,
    userName,
  });

  // Form context passes collaboration state to widgets
  const formContext = useMemo<CollaborativeFormContext | null>(() => {
    if (!ydoc || !provider) {
      return null;
    }
    return { ydoc, provider, userName };
  }, [ydoc, provider, userName]);

  // Generate uiSchema from JSON Schema with collaborative widgets
  const uiSchema = useMemo(
    () =>
      mergeUiSchema(
        generateUiSchema(PROPOSAL_SCHEMA, { collaborative: true }),
        PROPOSAL_UI_OVERRIDES,
      ),
    [],
  );

  // Custom widgets registry - merge base widgets with our collaborative ones
  const widgets = useMemo(
    () => ({
      ...BaseCustomWidgets,
      CollaborativeText: CollaborativeTextWidget,
      CollaborativeRichText: CollaborativeRichTextWidget,
    }),
    [],
  );

  const handleChange = useCallback(
    ({ formData: newFormData }: { formData?: Partial<ProposalFormData> }) => {
      if (newFormData) {
        setFormData(newFormData);
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    async ({
      formData: submitData,
    }: {
      formData?: Partial<ProposalFormData>;
    }) => {
      if (!submitData) {
        return;
      }

      // Validate required fields
      if (!submitData.summary?.trim()) {
        toast.error({ message: t('Summary is required') });
        return;
      }

      // For description, we need to check if the collaborative editor has content
      // The HTML might just be empty paragraph tags
      const descriptionHtml = submitData.description || '';
      const hasDescription =
        descriptionHtml.replace(/<[^>]*>/g, '').trim().length > 0;

      if (!hasDescription) {
        toast.error({ message: t('Description is required') });
        return;
      }

      setIsSubmitting(true);
      try {
        // At this point we've validated the data, so we can safely cast
        onSubmit?.(submitData as ProposalFormData);
        toast.success({ message: t('Proposal saved successfully') });
      } catch (error) {
        console.error('Failed to submit proposal:', error);
        toast.error({ message: t('Failed to save proposal') });
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit, t],
  );

  // Show loading state while connecting
  if (!provider || status === 'connecting') {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          <span className="text-sm text-neutral-gray4">
            {t('Connecting to collaboration server...')}
          </span>
        </div>
        <RichTextEditorSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Connection status indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${
            status === 'connected' ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-sm text-neutral-gray4">
          {status === 'connected'
            ? isSynced
              ? t('Connected and synced')
              : t('Connected, syncing...')
            : t('Disconnected')}
        </span>
      </div>

      {/* RJSF Form */}
      <Form<Partial<ProposalFormData>>
        schema={PROPOSAL_SCHEMA}
        uiSchema={uiSchema}
        formData={formData}
        formContext={formContext ?? undefined}
        onChange={handleChange}
        onSubmit={handleSubmit}
        validator={validator}
        widgets={widgets}
        templates={CustomTemplates}
        showErrorList={false}
        liveValidate={false}
        noHtml5Validate
      >
        {/* Custom submit button */}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="submit"
            variant="primary"
            isDisabled={isSubmitting || status !== 'connected'}
          >
            {isSubmitting ? t('Saving...') : t('Save Proposal')}
          </Button>
        </div>
      </Form>
    </div>
  );
}
