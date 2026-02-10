'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import {
  type ProcessInstance,
  ProposalStatus,
  type proposalEncoder,
} from '@op/api/encoders';
import { type ProposalDataInput, parseProposalData } from '@op/common/client';
import { toast } from '@op/ui/Toast';
import Form from '@rjsf/core';
import type { StrictRJSFSchema } from '@rjsf/utils';
import type { Editor } from '@tiptap/react';
import { useRouter } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import {
  RichTextEditorToolbar,
  getProposalExtensions,
} from '../../RichTextEditor';
import {
  CollaborativeDocProvider,
  CollaborativeEditor,
  CollaborativePresence,
} from '../../collaboration';
import { ProposalAttachments } from '../ProposalAttachments';
import { ProposalEditorSkeleton } from '../ProposalEditorSkeleton';
import { ProposalInfoModal } from '../ProposalInfoModal';
import { ProposalEditorLayout } from '../layout';
import { compileProposalSchema } from './compileProposalSchema';
import { handleMutationError } from './handleMutationError';
import {
  RJSF_FIELDS,
  RJSF_TEMPLATES,
  RJSF_WIDGETS,
  proposalValidator,
} from './rjsfConfig';
import { useInstanceConfig } from './useInstanceConfig';
import { useProposalDraft } from './useProposalDraft';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Proposal = z.infer<typeof proposalEncoder>;

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

  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDraft = isEditMode && proposal?.status === ProposalStatus.DRAFT;

  // -- Instance config -------------------------------------------------------

  const { categories, budgetCapAmount, isBudgetRequired, isCategoryRequired } =
    useInstanceConfig(instance);

  const proposalInfoTitle = instance.instanceData?.fieldValues
    ?.proposalInfoTitle as string | undefined;
  const proposalInfoContent = instance.instanceData?.fieldValues
    ?.proposalInfoContent as string | undefined;

  // -- Collaboration ---------------------------------------------------------

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

  // -- Draft management ------------------------------------------------------

  const { draft, draftRef, handleFormChange } = useProposalDraft({
    proposal,
    isEditMode,
    collaborationDocId,
  });

  // -- RJSF schema compilation -----------------------------------------------

  const rawProposalTemplate = (instance.process?.processSchema
    ?.proposalTemplate ?? null) as StrictRJSFSchema | null;

  const proposalTemplateWithMockField = useMemo<StrictRJSFSchema>(() => {
    const base: StrictRJSFSchema = rawProposalTemplate ?? {
      type: 'object',
      properties: {},
      required: [],
    };

    return {
      ...base,
      properties: {
        ...base.properties,
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
    () => compileProposalSchema(proposalTemplateWithMockField, t),
    [proposalTemplateWithMockField, t],
  );

  // -- Mutations -------------------------------------------------------------

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

  // -- UI state handlers -----------------------------------------------------

  const handleEditorReady = useCallback((editor: Editor) => {
    setEditorInstance(editor);
  }, []);

  const handleCloseInfoModal = useCallback(() => {
    setShowInfoModal(false);
  }, []);

  // Show info modal on mount for new/draft proposals
  useEffect(() => {
    if ((!isEditMode || isDraft) && proposalInfoTitle && proposalInfoContent) {
      setShowInfoModal(true);
    }
  }, [isEditMode, isDraft, proposalInfoTitle, proposalInfoContent]);

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
    draftRef,
  ]);

  // -- Render ----------------------------------------------------------------

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
