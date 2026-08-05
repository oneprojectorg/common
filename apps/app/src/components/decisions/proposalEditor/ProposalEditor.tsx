'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { DATE_TIME_UTC_FORMAT, formatDate } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import { type ProcessInstance, ProposalStatus } from '@op/api/encoders';
import {
  type Proposal,
  type ProposalDataInput,
  type ProposalReviewRequest,
  type ProposalTemplateSchema,
  parseProposalData,
} from '@op/common/client';
import { logger } from '@op/logging/client';
import { SplitPane } from '@op/sense/SplitPane';
import { toast } from '@op/sense/Toast';
import type { Editor } from '@tiptap/react';
import { useLocale } from 'next-intl';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import { RichTextEditorToolbar } from '../../RichTextEditor';
import {
  CollaborativeDocProvider,
  CollaborativePresence,
  useCollaborativeDoc,
  useOptionalCollaborativeDoc,
} from '../../collaboration';
import { ProposalAttachments } from '../ProposalAttachments';
import { ProposalEditorLayout } from '../ProposalEditorLayout';
import { ProposalEditorSkeleton } from '../ProposalEditorSkeleton';
import { ProposalInfoModal } from '../ProposalInfoModal';
import { compileProposalSchema } from '../forms/proposal';
import { schemaHasOptions } from '../proposalTemplate';
import { CustomFormModal, type CustomFormValues } from './CustomFormModal';
import { ProposalFormRenderer } from './ProposalFormRenderer';
import { RevisionFeedbackPanel } from './RevisionFeedbackPanel';
import { useOptionalVersionPreview } from './VersionPreviewContext';
import { handleMutationError } from './handleMutationError';
import { getFragmentText } from './proposalPreviewContent';
import { useProposalDraft } from './useProposalDraft';
import { useProposalValidation } from './useProposalValidation';

// Create a version snapshot after 60 seconds without local edits.
const VERSION_INTERVAL_SECONDS = 60;

/**
 * Tracks which TipTap editor currently has focus.
 *
 * Handles the blur/focus race condition: when clicking from editor A to
 * editor B, `blur` fires before `focus`. We defer the blur-to-null via
 * `requestAnimationFrame` and cancel it when a focus fires first.
 */
function useFocusedEditor() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const pendingBlur = useRef<number | null>(null);

  const onEditorFocus = useCallback((e: Editor) => {
    if (pendingBlur.current !== null) {
      cancelAnimationFrame(pendingBlur.current);
      pendingBlur.current = null;
    }
    setEditor(e);
  }, []);

  const onEditorBlur = useCallback((e: Editor) => {
    pendingBlur.current = requestAnimationFrame(() => {
      pendingBlur.current = null;
      setEditor((cur) => (cur === e ? null : cur));
    });
  }, []);

  useEffect(() => {
    return () => {
      if (pendingBlur.current !== null) {
        cancelAnimationFrame(pendingBlur.current);
      }
    };
  }, []);

  return { editor, onEditorFocus, onEditorBlur };
}

export function ProposalEditor({
  instance,
  backHref,
  proposal,
  isEditMode = false,
  asideHeaderIcons,
  versionHistoryOpen = false,
  revisionRequest = null,
}: {
  instance: ProcessInstance;
  backHref: string;
  proposal: Proposal;
  isEditMode?: boolean;
  asideHeaderIcons?: ReactNode;
  /**
   * True while the version-history aside is open. The main pane then switches to
   * the same readonly preview components a past version uses ("Current version"),
   * so no Yjs-bound editor stays mounted behind the panel.
   */
  versionHistoryOpen?: boolean;
  revisionRequest?: ProposalReviewRequest | null;
}) {
  const { user } = useRequiredUser();
  const t = useTranslations();

  // -- Collaboration ---------------------------------------------------------

  const collaborationDocId = useMemo(() => {
    const { collaborationDocId: existingId } = parseProposalData(
      proposal?.proposalData,
    );

    if (existingId) {
      return existingId;
    }

    throw new Error(
      'Legacy proposals without collaboration documents cannot be edited',
    );
  }, [proposal?.proposalData]);

  const userName = user.profile?.name ?? t('Anonymous');

  // -- Schema compilation ----------------------------------------------------

  const proposalTemplate = instance.instanceData.proposalTemplate;

  if (!proposalTemplate) {
    throw new Error('Proposal template not found on instance');
  }

  const existingCollab = useOptionalCollaborativeDoc();

  const inner = (
    <ProposalEditorInner
      instance={instance}
      backHref={backHref}
      proposal={proposal}
      isEditMode={isEditMode}
      asideHeaderIcons={asideHeaderIcons}
      versionHistoryOpen={versionHistoryOpen}
      collaborationDocId={collaborationDocId}
      proposalTemplate={proposalTemplate}
      revisionRequest={revisionRequest}
    />
  );

  if (existingCollab) {
    return inner;
  }

  return (
    <CollaborativeDocProvider
      docId={collaborationDocId}
      userName={userName}
      fallback={<ProposalEditorSkeleton />}
    >
      {inner}
    </CollaborativeDocProvider>
  );
}

/**
 * Inner component rendered inside `CollaborativeDocProvider` so it can
 * access the Yjs document for client-side schema validation.
 */
function ProposalEditorInner({
  instance,
  backHref,
  proposal,
  isEditMode,
  asideHeaderIcons,
  versionHistoryOpen = false,
  collaborationDocId,
  proposalTemplate,
  revisionRequest,
}: {
  instance: ProcessInstance;
  backHref: string;
  proposal: Proposal;
  isEditMode: boolean;
  asideHeaderIcons?: ReactNode;
  versionHistoryOpen?: boolean;
  collaborationDocId: string;
  proposalTemplate: ProposalTemplateSchema;
  revisionRequest: ProposalReviewRequest | null;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const { user } = useRequiredUser();
  const utils = trpc.useUtils();

  // Anon visitors get sent back with ?promote=1 so PromoteAccountModal offers an
  // upgrade. `isAnonymous` is session-derived, not the stale DB relation.
  const isAnonymous = Boolean(user?.isAnonymous);
  const { ydoc, provider, isSynced } = useCollaborativeDoc();
  const versionPreview = useOptionalVersionPreview();

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomFormModal, setShowCustomFormModal] = useState(false);
  const isPreviewMode = Boolean(versionPreview);
  // Opening the version-history panel freezes the main pane too. Drives the
  // attachment section's readonly state; the fields switch via `mode` below.
  const isReadOnlyPreview = isPreviewMode || versionHistoryOpen;
  const pendingVersionTimeoutRef = useRef<number | null>(null);

  const isDraft = isEditMode && proposal?.status === ProposalStatus.DRAFT;

  // Look up the optional form attached to this decision profile for the
  // current phase. A profile can attach a form per phase (tagged with
  // `x-phase`); a form with no `x-phase` applies to the initial/submission
  // phase. The form, not the slug, gates the modal. This subscription renders
  // the modal; the submit handler decides via `utils.customForm.getForProfile.fetch`
  // (cache-backed) so a click before this query resolves can't bypass the
  // required form.
  const initialPhaseId = instance.instanceData?.phases?.[0]?.phaseId;
  const { data: customForm } = trpc.customForm.getForProfile.useQuery(
    {
      profileId: instance.profileId ?? '',
      phaseId: instance.currentStateId ?? undefined,
      initialPhaseId,
    },
    { enabled: Boolean(instance.profileId) && isDraft },
  );

  // -- Instance config -------------------------------------------------------

  const proposalInfoTitle = instance.instanceData?.fieldValues
    ?.proposalInfoTitle as string | undefined;
  const proposalInfoContent = instance.instanceData?.fieldValues
    ?.proposalInfoContent as string | undefined;

  // -- Draft management ------------------------------------------------------

  const { draft, draftRef, handleFieldChange } = useProposalDraft({
    proposal,
    isEditMode,
    collaborationDocId,
  });

  // -- Schema compilation ----------------------------------------------------

  const templateRef = useRef(proposalTemplate);
  templateRef.current = proposalTemplate;

  const proposalFields = compileProposalSchema(proposalTemplate);
  const previewTitle = getFragmentText(versionPreview?.fragmentContents.title);
  const viewingLabel = versionPreview?.tiptapVersion
    ? t('Viewing {date}', {
        date: formatDate(
          new Date(versionPreview.tiptapVersion.date).toISOString(),
          locale,
          DATE_TIME_UTC_FORMAT,
        ),
      })
    : null;

  // -- Validation ------------------------------------------------------------

  const { validate } = useProposalValidation(ydoc, proposalTemplate);

  // -- Mutations -------------------------------------------------------------

  const submitProposalMutation = trpc.decision.submitProposal.useMutation({
    onError: (error) => handleMutationError(error, 'submit', t),
  });

  const updateProposalMutation = trpc.decision.updateProposal.useMutation({
    onError: (error) => handleMutationError(error, 'update', t),
  });

  const submitCustomFormMutation = trpc.customForm.submit.useMutation({
    onError: (error) => handleMutationError(error, 'submit', t),
  });

  // -- UI state handlers -----------------------------------------------------

  const handleCloseInfoModal = () => setShowInfoModal(false);

  // Show info modal on mount for new/draft proposals
  useEffect(() => {
    if ((!isEditMode || isDraft) && proposalInfoTitle && proposalInfoContent) {
      setShowInfoModal(true);
    }
  }, [isEditMode, isDraft, proposalInfoTitle, proposalInfoContent]);

  useEffect(() => {
    if (!provider || !isSynced || isPreviewMode) {
      return;
    }

    const scheduleVersionOnLocalChange = (transaction: { local: boolean }) => {
      if (!transaction.local) {
        return;
      }

      if (pendingVersionTimeoutRef.current !== null) {
        window.clearTimeout(pendingVersionTimeoutRef.current);
      }

      pendingVersionTimeoutRef.current = window.setTimeout(() => {
        pendingVersionTimeoutRef.current = null;

        provider.createVersion(undefined, true);
      }, VERSION_INTERVAL_SECONDS * 1000);
    };

    ydoc.on('afterTransaction', scheduleVersionOnLocalChange);

    return () => {
      ydoc.off('afterTransaction', scheduleVersionOnLocalChange);

      if (pendingVersionTimeoutRef.current !== null) {
        window.clearTimeout(pendingVersionTimeoutRef.current);
        pendingVersionTimeoutRef.current = null;
      }
    };
  }, [isPreviewMode, isSynced, provider, ydoc]);

  const finalizeSubmit = useCallback(async () => {
    const didSubmitDraft = isDraft && Boolean(proposal);
    if (didSubmitDraft && proposal) {
      await submitProposalMutation.mutateAsync({
        proposalId: proposal.id,
      });
    }

    router.push(
      didSubmitDraft && isAnonymous && proposal
        ? `${backHref}?promote=1&proposal=${proposal.profileId}`
        : backHref,
    );
  }, [
    isDraft,
    proposal,
    submitProposalMutation,
    router,
    isAnonymous,
    backHref,
  ]);

  const handleSubmitProposal = useCallback(async () => {
    const currentDraft = draftRef.current;
    const template = templateRef.current;

    // -- Client-side schema validation (validates ALL template fields) --------
    const result = validate();
    if (!result.valid) {
      toast.error(t('Please fix the following issues:'), {
        description: Object.values(result.errors).join(', '),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (!proposal) {
        throw new Error('No proposal to update');
      }

      const categorySchema = template.properties?.category;
      const hasCategories =
        typeof categorySchema === 'object' && schemaHasOptions(categorySchema);

      const proposalData: ProposalDataInput = {
        ...parseProposalData(proposal.proposalData),
        collaborationDocId,
        category: hasCategories
          ? currentDraft.category.length > 0
            ? currentDraft.category
            : undefined
          : undefined,
        budget: currentDraft.budget ?? undefined,
      };

      await updateProposalMutation.mutateAsync({
        proposalId: proposal.id,
        data: {
          title: currentDraft.title,
          proposalData,
          ...(!isDraft ? { checkpointVersion: { type: 'update' } } : {}),
        },
      });

      // The custom form gates proposal submission only (the draft -> submit
      // transition). The phase params select the form tied to the current
      // phase; voting-phase forms are gated separately on the voting page.
      // Resolve via the query cache (fetch, not hook state) so a click before
      // the subscription resolves still routes through the required form.
      if (isDraft && instance.profileId) {
        const form = await utils.customForm.getForProfile.fetch({
          profileId: instance.profileId,
          phaseId: instance.currentStateId ?? undefined,
          initialPhaseId,
        });
        if (form) {
          setShowCustomFormModal(true);
          return;
        }
      }

      await finalizeSubmit();
    } catch (error) {
      logger.error('Failed to update proposal', {
        error,
        context: 'ProposalEditor.handleSubmitProposal',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    t,
    collaborationDocId,
    proposal,
    isDraft,
    instance.profileId,
    instance.currentStateId,
    initialPhaseId,
    utils,
    updateProposalMutation,
    draftRef,
    validate,
    finalizeSubmit,
  ]);

  const handleCustomFormSubmit = useCallback(
    async (values: CustomFormValues) => {
      if (!customForm || !proposal) {
        return;
      }
      setIsSubmitting(true);
      try {
        await submitCustomFormMutation.mutateAsync({
          customFormId: customForm.id,
          profileId: proposal.profileId,
          data: values,
        });
        await finalizeSubmit();
        setShowCustomFormModal(false);
      } catch (error) {
        logger.error('Failed to submit custom form', {
          error,
          context: 'ProposalEditor.handleCustomFormSubmit',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [customForm, proposal, submitCustomFormMutation, finalizeSubmit],
  );

  // Dismissing the modal cancels the whole submission — the proposal stays
  // a draft (already saved) and the user remains on the editor. Completing
  // the form is required to finish submitting.
  const handleCustomFormOpenChange = useCallback(
    (open: boolean) => {
      if (!isSubmitting) {
        setShowCustomFormModal(open);
      }
    },
    [isSubmitting],
  );

  // -- Render ----------------------------------------------------------------

  const {
    editor: focusedEditor,
    onEditorFocus,
    onEditorBlur,
  } = useFocusedEditor();

  const editorBody = (
    <>
      <ProposalFormRenderer
        fields={proposalFields}
        draft={draft}
        decisionProfileId={instance.profileId ?? null}
        onFieldChange={handleFieldChange}
        onEditorFocus={onEditorFocus}
        onEditorBlur={onEditorBlur}
        // Version history open with nothing selected = "Current version": the
        // same readonly components as a past version, so no Yjs-bound editor is
        // mounted while the panel is up.
        mode={
          isPreviewMode
            ? 'preview-version'
            : versionHistoryOpen
              ? 'preview-current'
              : 'edit-collaborative'
        }
        currentFieldContents={proposal.htmlContent ?? undefined}
        previewVersionFragmentContents={versionPreview?.fragmentContents}
      />

      <div className="border-t pt-8">
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
          readOnly={isReadOnlyPreview}
        />
      </div>
    </>
  );

  return (
    <ProposalEditorLayout
      backHref={backHref}
      title={isPreviewMode ? previewTitle || draft.title : draft.title}
      statusSlot={
        viewingLabel ? (
          <span className="truncate text-sm text-muted-foreground">
            {viewingLabel}
          </span>
        ) : undefined
      }
      onSubmitProposal={handleSubmitProposal}
      isSubmitting={isSubmitting}
      isEditMode={isEditMode}
      isDraft={isDraft}
      readOnlyMode={isPreviewMode}
      presenceSlot={<CollaborativePresence />}
      asideHeaderIcons={asideHeaderIcons}
      proposalProfileId={proposal.profileId}
      access={proposal.access}
      revisionRequest={revisionRequest}
    >
      <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[auto_1fr]">
        <div
          className="border-b bg-background"
          onMouseDown={(e) => e.preventDefault()}
        >
          <RichTextEditorToolbar editor={focusedEditor} />
        </div>
        <div className="relative min-h-0 overflow-y-auto">
          {revisionRequest ? (
            <SplitPane className="mx-auto w-full max-w-6xl">
              <SplitPane.Pane
                id="proposal"
                label={t('Proposal')}
                className="gap-4"
              >
                {editorBody}
              </SplitPane.Pane>
              <SplitPane.Pane
                id="feedback"
                label={t('Revision feedback')}
                className="bg-background"
                unpadded
              >
                <RevisionFeedbackPanel revisionRequest={revisionRequest} />
              </SplitPane.Pane>
            </SplitPane>
          ) : (
            /* Figma column: 544px wide, 56 top/bottom pad, 40 region gap
               (mobile: 32/16 pad, 24 gap). */
            <div className="flex flex-1 flex-col py-8 sm:py-14">
              <div className="mx-auto flex w-full max-w-136 flex-col gap-6 px-4 sm:gap-10 sm:px-6">
                {editorBody}
              </div>
            </div>
          )}
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

      {customForm && (
        <CustomFormModal
          isOpen={showCustomFormModal}
          schema={customForm.schema}
          isSubmitting={isSubmitting}
          onSubmit={handleCustomFormSubmit}
          onOpenChange={handleCustomFormOpenChange}
          submitLabel={t('Submit my idea')}
        />
      )}
    </ProposalEditorLayout>
  );
}
