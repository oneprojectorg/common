'use client';

import { useUser } from '@/utils/UserProvider';
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
import { SplitPane } from '@op/ui/SplitPane';
import { toast } from '@op/ui/Toast';
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
  showHeaderActions = true,
  revisionRequest = null,
}: {
  instance: ProcessInstance;
  backHref: string;
  proposal: Proposal;
  isEditMode?: boolean;
  asideHeaderIcons?: ReactNode;
  showHeaderActions?: boolean;
  revisionRequest?: ProposalReviewRequest | null;
}) {
  const { user } = useUser();
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
      showHeaderActions={showHeaderActions}
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
  showHeaderActions,
  collaborationDocId,
  proposalTemplate,
  revisionRequest,
}: {
  instance: ProcessInstance;
  backHref: string;
  proposal: Proposal;
  isEditMode: boolean;
  asideHeaderIcons?: ReactNode;
  showHeaderActions: boolean;
  collaborationDocId: string;
  proposalTemplate: ProposalTemplateSchema;
  revisionRequest: ProposalReviewRequest | null;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const utils = trpc.useUtils();
  const { ydoc, provider, isSynced } = useCollaborativeDoc();
  const versionPreview = useOptionalVersionPreview();

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPreviewMode = Boolean(versionPreview);
  const pendingVersionTimeoutRef = useRef<number | null>(null);

  const isDraft = isEditMode && proposal?.status === ProposalStatus.DRAFT;

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

  const handleSubmitProposal = useCallback(async () => {
    const currentDraft = draftRef.current;
    const template = templateRef.current;

    // -- Client-side schema validation (validates ALL template fields) --------
    const result = validate();
    if (!result.valid) {
      toast.error({
        title: t('Please fix the following issues:'),
        message: Object.values(result.errors).join(', '),
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

      if (isDraft) {
        await submitProposalMutation.mutateAsync({
          proposalId: proposal.id,
        });
      }

      router.push(backHref);
    } catch (error) {
      console.error('Failed to update proposal:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    t,
    collaborationDocId,
    proposal,
    isDraft,
    submitProposalMutation,
    updateProposalMutation,
    draftRef,
    validate,
  ]);

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
        onFieldChange={handleFieldChange}
        onEditorFocus={onEditorFocus}
        onEditorBlur={onEditorBlur}
        mode={isPreviewMode ? 'preview-version' : 'edit-collaborative'}
        previewVersionFragmentContents={versionPreview?.fragmentContents}
      />

      <div className="border-t border-neutral-gray1 pt-8">
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
    </>
  );

  return (
    <ProposalEditorLayout
      backHref={backHref}
      title={isPreviewMode ? previewTitle || draft.title : draft.title}
      statusSlot={
        viewingLabel ? (
          <div className="rounded-sm bg-neutral-gray1 px-4 py-2 text-sm text-neutral-charcoal">
            {viewingLabel}
          </div>
        ) : undefined
      }
      onSubmitProposal={handleSubmitProposal}
      isSubmitting={isSubmitting}
      isEditMode={isEditMode}
      isDraft={isDraft}
      readOnlyMode={isPreviewMode}
      presenceSlot={<CollaborativePresence />}
      asideHeaderIcons={asideHeaderIcons}
      showHeaderActions={showHeaderActions}
      proposalProfileId={proposal.profileId}
      access={proposal.access}
      revisionRequest={revisionRequest}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div
          className="sticky top-0 z-10 border-b border-neutral-gray1 bg-white"
          onMouseDown={(e) => e.preventDefault()}
        >
          <RichTextEditorToolbar editor={focusedEditor} />
        </div>
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
              className="bg-white"
              unpadded
            >
              <RevisionFeedbackPanel revisionRequest={revisionRequest} />
            </SplitPane.Pane>
          </SplitPane>
        ) : (
          <div className="flex flex-1 flex-col gap-12 py-12">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6">
              {editorBody}
            </div>
          </div>
        )}
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
  );
}
