'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import {
  type ProcessInstance,
  ProposalStatus,
  type proposalEncoder,
} from '@op/api/encoders';
import { type ProposalDataInput, parseProposalData } from '@op/common/client';
import { useDebouncedCallback } from '@op/hooks';
import { toast } from '@op/ui/Toast';
import Form, { type IChangeEvent } from '@rjsf/core';
import type {
  FieldProps,
  ObjectFieldTemplateProps,
  RJSFSchema,
  UiSchema,
  ValidatorType,
} from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import type { Editor } from '@tiptap/react';
import { useRouter } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import {
  RichTextEditorToolbar,
  getProposalExtensions,
} from '../RichTextEditor';
import {
  CollaborativeBudgetField,
  CollaborativeCategoryField,
  CollaborativeDocProvider,
  CollaborativeEditor,
  CollaborativePresence,
  CollaborativeShortTextWidget,
  CollaborativeTitleField,
} from '../collaboration';
import { ProposalAttachments } from './ProposalAttachments';
import { ProposalEditorLayout } from './ProposalEditorLayout';
import { ProposalEditorSkeleton } from './ProposalEditorSkeleton';
import { ProposalInfoModal } from './ProposalInfoModal';

type Proposal = z.infer<typeof proposalEncoder>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Draft state for the three system fields persisted to proposalData.
 * Dynamic template fields live exclusively in Yjs and are NOT part of this.
 */
interface ProposalDraftFields extends Record<string, unknown> {
  title: string;
  category: string | null;
  budget: number | null;
}

/**
 * Extra props passed to RJSF fields/widgets via `formContext`.
 * Contains runtime data that the schema alone can't express.
 */
interface ProposalFormContext {
  categories: Array<{ id: string; name: string }>;
  budgetCapAmount?: number;
}

// ---------------------------------------------------------------------------
// Schema compilation — proposalTemplate (JSON Schema) → RJSF schema + uiSchema
// ---------------------------------------------------------------------------

/**
 * Known system property keys in the proposal template schema.
 * These get special `ui:field` rendering (collaborative wrappers)
 * and are persisted to proposalData. Everything else is treated
 * as a dynamic template field rendered via `CollaborativeShortText`.
 */
const SYSTEM_FIELD_KEYS = new Set([
  'title',
  'description',
  'budget',
  'category',
]);

/**
 * Builds the complete RJSF schema and uiSchema from the stored
 * `processSchema.proposalTemplate` (JSON Schema).
 *
 * System fields (title, category, budget) get dedicated `ui:field`
 * wrappers that use our collaborative components.
 * Dynamic fields (user-created via template builder) get rendered
 * as `CollaborativeShortText` widgets backed by Yjs fragments.
 * Dynamic field values live exclusively in Yjs — they are NOT
 * persisted to proposalData.
 *
 * @param proposalTemplate - The raw JSON Schema stored on processSchema
 * @param budgetCapAmount - Optional budget ceiling from phase settings
 * @param t - Translation function
 */
function compileProposalSchema(
  proposalTemplate: Record<string, unknown> | null,
  budgetCapAmount: number | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
): {
  schema: RJSFSchema;
  uiSchema: UiSchema<Record<string, unknown>, RJSFSchema, ProposalFormContext>;
} {
  // Pull required array from stored template
  const templateRequired =
    proposalTemplate &&
    'required' in proposalTemplate &&
    Array.isArray(proposalTemplate.required)
      ? (proposalTemplate.required as string[])
      : [];

  const isCategoryRequired = templateRequired.includes('category');

  // System fields — always present regardless of template contents
  const schemaProperties: NonNullable<RJSFSchema['properties']> = {
    title: { type: 'string', title: t('Title'), minLength: 1 },
    category: {
      type: isCategoryRequired ? 'string' : ['string', 'null'],
      title: t('Category'),
    },
    budget: {
      type: ['number', 'null'],
      title: t('Budget'),
      minimum: 0,
      ...(budgetCapAmount ? { maximum: budgetCapAmount } : {}),
    },
  };

  const uiProperties: Record<string, unknown> = {
    title: {
      'ui:field': 'CollaborativeTitleField',
      'ui:placeholder': t('Untitled Proposal'),
    },
    category: { 'ui:field': 'CollaborativeCategoryField' },
    budget: { 'ui:field': 'CollaborativeBudgetField' },
  };

  // Merge dynamic (non-system) properties from the stored template
  if (
    proposalTemplate &&
    'properties' in proposalTemplate &&
    proposalTemplate.properties &&
    typeof proposalTemplate.properties === 'object'
  ) {
    const templateProps = proposalTemplate.properties as Record<
      string,
      Record<string, unknown>
    >;

    for (const [key, propSchema] of Object.entries(templateProps)) {
      if (SYSTEM_FIELD_KEYS.has(key)) {
        continue;
      }

      // Dynamic field — add to schema and wire as collaborative short text.
      // The field key is used as both the JSON Schema property name
      // and the Yjs fragment name for collaborative editing.
      schemaProperties[key] = {
        type: 'string',
        ...(propSchema.title ? { title: String(propSchema.title) } : {}),
        ...(propSchema.description
          ? { description: String(propSchema.description) }
          : {}),
      };

      uiProperties[key] = {
        'ui:widget': 'CollaborativeShortText',
        'ui:options': { field: key },
      };
    }
  }

  const required = Array.from(new Set(['title', ...templateRequired])).filter(
    (key) => key in schemaProperties,
  );

  return {
    schema: { type: 'object', required, properties: schemaProperties },
    uiSchema: uiProperties as UiSchema<
      Record<string, unknown>,
      RJSFSchema,
      ProposalFormContext
    >,
  };
}

// ---------------------------------------------------------------------------
// RJSF custom field wrappers — bridge RJSF ↔ collaborative components
// ---------------------------------------------------------------------------

/**
 * RJSF custom field: collaborative proposal title.
 * Renders a TipTap editor bound to the "title" Y.Doc fragment.
 * Calls `props.onChange` on every keystroke so RJSF mirrors the Yjs value.
 */
function CollaborativeTitleRjsfField(props: FieldProps) {
  const placeholder = props.uiSchema?.['ui:placeholder'] as string | undefined;

  return (
    <CollaborativeTitleField
      placeholder={placeholder}
      onChange={(value) => props.onChange(value)}
    />
  );
}

/**
 * RJSF custom field: collaborative category selector.
 * Reads available categories from `formContext`.
 */
function CollaborativeCategoryRjsfField(props: FieldProps) {
  const { categories } = (props.formContext ?? {}) as ProposalFormContext;

  return (
    <CollaborativeCategoryField
      categories={categories}
      initialValue={(props.formData as string | null) ?? null}
      onChange={(value) => props.onChange(value)}
    />
  );
}

/**
 * RJSF custom field: collaborative budget input.
 * Reads `budgetCapAmount` from `formContext`.
 */
function CollaborativeBudgetRjsfField(props: FieldProps) {
  const { budgetCapAmount } = (props.formContext ?? {}) as ProposalFormContext;

  return (
    <CollaborativeBudgetField
      budgetCapAmount={budgetCapAmount}
      initialValue={(props.formData as number | null) ?? null}
      onChange={(value) => props.onChange(value)}
    />
  );
}

// ---------------------------------------------------------------------------
// RJSF registries
// ---------------------------------------------------------------------------

const RJSF_FIELDS = {
  CollaborativeTitleField: CollaborativeTitleRjsfField,
  CollaborativeCategoryField: CollaborativeCategoryRjsfField,
  CollaborativeBudgetField: CollaborativeBudgetRjsfField,
};

const RJSF_WIDGETS = {
  CollaborativeShortText: CollaborativeShortTextWidget,
};

// ---------------------------------------------------------------------------
// RJSF templates — suppress default chrome, control layout
// ---------------------------------------------------------------------------

/** Suppress RJSF's default label/description — our fields handle their own. */
function FieldTemplate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * Custom object template that renders system fields in the correct layout:
 * - Title at full width
 * - Category + Budget side-by-side in a flex row
 * - All dynamic template fields stacked below
 */
function ObjectFieldTemplate({ properties }: ObjectFieldTemplateProps) {
  const titleProp = properties.find((p) => p.name === 'title');
  const categoryProp = properties.find((p) => p.name === 'category');
  const budgetProp = properties.find((p) => p.name === 'budget');

  const dynamicProps = properties.filter((p) => !SYSTEM_FIELD_KEYS.has(p.name));

  return (
    <div className="space-y-4">
      {titleProp?.content}

      {(categoryProp || budgetProp) && (
        <div className="flex gap-2">
          {categoryProp?.content}
          {budgetProp?.content}
        </div>
      )}

      {dynamicProps.map((prop) => prop.content)}
    </div>
  );
}

const RJSF_TEMPLATES = { FieldTemplate, ObjectFieldTemplate };

// ---------------------------------------------------------------------------
// Validator — cast once to satisfy RJSF generics
// ---------------------------------------------------------------------------

const proposalValidator = validator as ValidatorType<
  Record<string, unknown>,
  RJSFSchema,
  ProposalFormContext
>;

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

/** Handles tRPC validation errors from mutation responses. */
function handleMutationError(
  error: { data?: unknown; message?: string },
  operationType: 'create' | 'update' | 'submit',
  t: (key: string, params?: Record<string, string | number>) => string,
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
        title: t('Please fix the following issues:'),
        message: errorMessages.join(', '),
      });
    }
  } else {
    const titleMap = {
      create: t('Failed to create proposal'),
      update: t('Failed to update proposal'),
      submit: t('Failed to submit proposal'),
    } as const;
    toast.error({
      title: titleMap[operationType],
      message: error.message || t('An unexpected error occurred'),
    });
  }
}

// ---------------------------------------------------------------------------
// ProposalEditor
// ---------------------------------------------------------------------------

export function ProposalEditor({
  instance,
  backHref,
  proposal,
  isEditMode = false,
}: {
  instance: ProcessInstance;
  backHref: string;
  proposal: Proposal;
  isEditMode?: boolean;
}) {
  const { user } = useUser();
  const router = useRouter();
  const t = useTranslations();
  const posthog = usePostHog();
  const utils = trpc.useUtils();

  // -- Parsed server state --------------------------------------------------

  const parsedProposalData = useMemo(
    () =>
      isEditMode && proposal ? parseProposalData(proposal.proposalData) : null,
    [isEditMode, proposal],
  );

  const initialDraft = useMemo<ProposalDraftFields>(
    () => ({
      title: parsedProposalData?.title ?? '',
      category: parsedProposalData?.category ?? null,
      budget: parsedProposalData?.budget ?? null,
    }),
    [
      parsedProposalData?.title,
      parsedProposalData?.category,
      parsedProposalData?.budget,
    ],
  );

  const [draft, setDraft] = useState<ProposalDraftFields>(initialDraft);

  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDraft = isEditMode && proposal?.status === ProposalStatus.DRAFT;

  // -- Collaboration --------------------------------------------------------

  const collaborationDocId = useMemo(() => {
    const { collaborationDocId: existingId } = parseProposalData(
      proposal?.proposalData,
    );
    if (existingId) {
      return existingId;
    }
    return `proposal-${instance.id}-${proposal?.id ?? crypto.randomUUID()}`;
  }, [proposal?.proposalData, proposal?.id, instance.id]);

  const editorExtensions = useMemo(
    () => getProposalExtensions({ collaborative: true }),
    [],
  );

  // -- Instance config ------------------------------------------------------

  const proposalInfoTitle = instance.instanceData?.fieldValues
    ?.proposalInfoTitle as string | undefined;
  const proposalInfoContent = instance.instanceData?.fieldValues
    ?.proposalInfoContent as string | undefined;

  const [categoriesData] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId: instance.id,
  });
  const { categories } = categoriesData;

  const { budgetCapAmount, isBudgetRequired, isCategoryRequired } =
    useMemo(() => {
      let cap: number | undefined;
      let budgetRequired = true;
      let categoryRequired = true;

      const currentPhaseId = instance.instanceData?.currentPhaseId;
      const currentPhaseData = instance.instanceData?.phases?.find(
        (p) => p.phaseId === currentPhaseId,
      );
      const phaseBudget = currentPhaseData?.settings?.budget as
        | number
        | undefined;

      if (phaseBudget != null) {
        return {
          budgetCapAmount: phaseBudget,
          isBudgetRequired: budgetRequired,
          isCategoryRequired: categoryRequired,
        };
      }

      const proposalTemplate =
        instance.process?.processSchema?.proposalTemplate;
      if (
        proposalTemplate &&
        typeof proposalTemplate === 'object' &&
        'properties' in proposalTemplate
      ) {
        const properties = proposalTemplate.properties;
        if (
          properties &&
          typeof properties === 'object' &&
          'budget' in properties
        ) {
          const budgetProp = properties.budget;
          if (
            budgetProp &&
            typeof budgetProp === 'object' &&
            'maximum' in budgetProp
          ) {
            cap = budgetProp.maximum as number;
          }
        }

        if (
          'required' in proposalTemplate &&
          Array.isArray(proposalTemplate.required)
        ) {
          budgetRequired = proposalTemplate.required.includes('budget');
          categoryRequired = proposalTemplate.required.includes('category');
        }
      }

      if (!cap && instance.instanceData?.fieldValues?.budgetCapAmount) {
        cap = instance.instanceData.fieldValues.budgetCapAmount as number;
      }

      return {
        budgetCapAmount: cap,
        isBudgetRequired: budgetRequired,
        isCategoryRequired: categoryRequired,
      };
    }, [instance]);

  // -- RJSF schema compilation ----------------------------------------------
  //
  // The proposalTemplate stored on processSchema is already JSON Schema.
  // We read it, inject system field uiSchema mappings, and derive dynamic
  // field widgets for any non-system properties.
  //
  // HACK: Until the template builder (PR #541) lands and persists to the
  // server, we inject a mock dynamic field into the template to prove the
  // compilation path works end-to-end.

  const rawProposalTemplate = (instance.process?.processSchema
    ?.proposalTemplate ?? null) as Record<string, unknown> | null;

  const proposalTemplateWithMockField = useMemo(() => {
    const base = rawProposalTemplate ?? {
      type: 'object',
      properties: {},
      required: [],
    };
    const properties = (base.properties ?? {}) as Record<string, unknown>;

    return {
      ...base,
      properties: {
        ...properties,
        // Mock dynamic field — remove once template builder persists to server
        fld_need_assessment: {
          type: 'string',
          title: 'Is there a high NEED for this project?',
          description:
            'Consider: Do the worker-owners clearly demonstrate a significant financial or operational need? Would this project address barriers the co-op faces to survival or growth?',
        },
      },
    };
  }, [rawProposalTemplate]);

  const { schema: proposalSchema, uiSchema: proposalUiSchema } = useMemo(
    () =>
      compileProposalSchema(proposalTemplateWithMockField, budgetCapAmount, t),
    [proposalTemplateWithMockField, budgetCapAmount, t],
  );

  // -- Mutations ------------------------------------------------------------

  const submitProposalMutation = trpc.decision.submitProposal.useMutation({
    onSuccess: async () => {
      posthog?.capture('submit_proposal_success', {
        process_instance_id: instance.id,
        process_name: instance.name || instance.instanceData?.templateName,
      });
      await utils.decision.listProposals.invalidate({
        processInstanceId: instance.id,
      });
      router.push(backHref);
    },
    onError: (error) => handleMutationError(error, 'submit', t),
  });

  const updateProposalMutation = trpc.decision.updateProposal.useMutation({
    onSuccess: async () => {
      await utils.decision.getProposal.invalidate({
        profileId: proposal?.profileId,
      });
      await utils.decision.listProposals.invalidate({
        processInstanceId: instance.id,
      });
      router.push(backHref);
    },
    onError: (error) => handleMutationError(error, 'update', t),
  });

  const autoSaveMutation = trpc.decision.updateProposal.useMutation({
    onError: (error) => {
      console.error('Auto-save failed:', error);
    },
  });

  // -- Draft management -----------------------------------------------------

  const draftRef = useRef<ProposalDraftFields>(initialDraft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    draftRef.current = initialDraft;
    setDraft(initialDraft);
  }, [initialDraft]);

  /**
   * Builds the proposalData payload for server persistence.
   * Only system fields (title, category, budget) are included —
   * dynamic template field values live in Yjs exclusively.
   */
  const buildProposalData = useCallback(
    (nextDraft: ProposalDraftFields): ProposalDataInput => {
      const serverData = parseProposalData(proposal?.proposalData);
      return {
        ...serverData,
        collaborationDocId,
        title: nextDraft.title,
        category: nextDraft.category ?? undefined,
        budget: nextDraft.budget ?? undefined,
      };
    },
    [proposal?.proposalData, collaborationDocId],
  );

  /**
   * Extracts system draft fields from RJSF formData.
   * Dynamic field values are ignored — they sync via Yjs only.
   */
  const toProposalDraft = useCallback(
    (formData: Record<string, unknown>): ProposalDraftFields => ({
      title: typeof formData.title === 'string' ? formData.title : '',
      category:
        typeof formData.category === 'string' ? formData.category : null,
      budget: typeof formData.budget === 'number' ? formData.budget : null,
    }),
    [],
  );

  const saveFields = useCallback(
    (nextDraft?: ProposalDraftFields) => {
      if (!proposal) {
        return;
      }
      const draftToPersist = nextDraft ?? draftRef.current;

      autoSaveMutation.mutate({
        proposalId: proposal.id,
        data: {
          proposalData: buildProposalData(draftToPersist),
        },
      });
    },
    [proposal, autoSaveMutation, buildProposalData],
  );

  const debouncedAutoSave = useDebouncedCallback(saveFields, 1500);

  // -- UI state handlers ----------------------------------------------------

  useEffect(() => {
    if ((!isEditMode || isDraft) && proposalInfoTitle && proposalInfoContent) {
      setShowInfoModal(true);
    }
  }, [isEditMode, isDraft, proposalInfoTitle, proposalInfoContent]);

  const handleEditorReady = useCallback((editor: Editor) => {
    setEditorInstance(editor);
  }, []);

  const handleCloseInfoModal = useCallback(() => {
    setShowInfoModal(false);
  }, []);

  /**
   * Handles RJSF form changes. Extracts system fields into the draft
   * and triggers debounced autosave for persistence.
   */
  const handleFormChange = useCallback(
    (event: IChangeEvent<Record<string, unknown>>) => {
      const nextDraft = toProposalDraft(
        (event.formData ?? {}) as Record<string, unknown>,
      );
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      debouncedAutoSave(nextDraft);
    },
    [toProposalDraft, debouncedAutoSave],
  );

  const handleSubmitProposal = useCallback(async () => {
    const currentDraft = draftRef.current;

    const missingFields: string[] = [];
    if (!currentDraft.title || currentDraft.title.trim() === '') {
      missingFields.push(t('Title'));
    }

    if (editorInstance) {
      if (editorInstance.isEmpty) {
        missingFields.push(t('Description'));
      }
    }

    if (isBudgetRequired && currentDraft.budget === null) {
      missingFields.push(t('Budget'));
    }

    if (
      isCategoryRequired &&
      categories &&
      categories.length > 0 &&
      currentDraft.category === null
    ) {
      missingFields.push(t('Category'));
    }

    if (
      currentDraft.budget !== null &&
      budgetCapAmount &&
      currentDraft.budget > budgetCapAmount
    ) {
      toast.error({
        message: t('Budget cannot exceed {amount}', {
          amount: budgetCapAmount.toLocaleString(),
        }),
      });
      return;
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
      if (!proposal) {
        throw new Error('No proposal to update');
      }

      const proposalData: ProposalDataInput = {
        ...parseProposalData(proposal.proposalData),
        collaborationDocId,
        title: currentDraft.title,
        category:
          categories && categories.length > 0
            ? (currentDraft.category ?? undefined)
            : undefined,
        budget: currentDraft.budget ?? undefined,
      };

      await updateProposalMutation.mutateAsync({
        proposalId: proposal.id,
        data: {
          proposalData,
        },
      });

      if (isDraft) {
        await submitProposalMutation.mutateAsync({
          proposalId: proposal.id,
        });
      }
    } catch (error) {
      console.error('Failed to update proposal:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    t,
    editorInstance,
    isBudgetRequired,
    isCategoryRequired,
    budgetCapAmount,
    collaborationDocId,
    categories,
    proposal,
    isDraft,
    submitProposalMutation,
    updateProposalMutation,
  ]);

  // -- Render ---------------------------------------------------------------

  const userName = user.profile?.name ?? t('Anonymous');

  return (
    <CollaborativeDocProvider
      docId={collaborationDocId}
      userName={userName}
      fallback={<ProposalEditorSkeleton />}
    >
      <ProposalEditorLayout
        backHref={backHref}
        title={draft.title}
        onSubmitProposal={handleSubmitProposal}
        isSubmitting={isSubmitting}
        isEditMode={isEditMode}
        isDraft={isDraft}
        presenceSlot={<CollaborativePresence />}
        proposalProfileId={proposal.profileId}
      >
        <div className="flex flex-1 flex-col gap-12">
          {editorInstance && <RichTextEditorToolbar editor={editorInstance} />}

          <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6">
            <Form
              schema={proposalSchema}
              uiSchema={proposalUiSchema}
              fields={RJSF_FIELDS}
              validator={proposalValidator}
              widgets={RJSF_WIDGETS}
              templates={RJSF_TEMPLATES}
              formData={draft}
              formContext={{
                categories: categories ?? [],
                budgetCapAmount,
              }}
              onChange={handleFormChange}
              showErrorList={false}
              liveValidate={false}
              noHtml5Validate
            >
              {/* Hide default submit button — we use our own in the layout */}
              <div />
            </Form>

            <CollaborativeEditor
              field="default"
              extensions={editorExtensions}
              onEditorReady={handleEditorReady}
              placeholder={t('Write your proposal here...')}
              editorClassName="w-full !max-w-128 sm:min-w-128 min-h-80 px-0 py-4"
            />

            <div className="border-t border-neutral-gray2 pt-8">
              <ProposalAttachments
                proposalId={proposal.id}
                attachments={
                  proposal.attachments?.map((pa) => ({
                    id: pa.attachmentId,
                    fileName: pa.attachment?.fileName ?? t('Unknown'),
                    fileSize: pa.attachment?.fileSize ?? null,
                    url: pa.attachment?.url,
                  })) ?? []
                }
                onMutate={() =>
                  utils.decision.getProposal.invalidate({
                    profileId: proposal.profileId,
                  })
                }
              />
            </div>
          </div>
        </div>

        {proposalInfoTitle && proposalInfoContent && (
          <ProposalInfoModal
            isOpen={showInfoModal}
            onClose={handleCloseInfoModal}
            title={proposalInfoTitle}
            content={proposalInfoContent}
          />
        )}
      </ProposalEditorLayout>
    </CollaborativeDocProvider>
  );
}
