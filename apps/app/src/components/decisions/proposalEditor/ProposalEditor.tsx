'use client';

import { useUser } from '@/utils/UserProvider';
import { DATE_TIME_UTC_FORMAT, formatDate } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import {
  type ProcessInstance,
  ProposalStatus,
  type proposalEncoder,
} from '@op/api/encoders';
import { type ProposalDataInput, parseProposalData } from '@op/common/client';
import type { ProposalTemplateSchema } from '@op/common/client';
import { toast } from '@op/ui/Toast';
import type { Editor, JSONContent } from '@tiptap/react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

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
import { useOptionalVersionPreview } from './VersionPreviewContext';
import { handleMutationError } from './handleMutationError';
import { useProposalDraft } from './useProposalDraft';
import { useProposalValidation } from './useProposalValidation';

type Proposal = z.infer<typeof proposalEncoder>;

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
}: {
  instance: ProcessInstance;
  backHref: string;
  proposal: Proposal;
  isEditMode?: boolean;
  asideHeaderIcons?: ReactNode;
  showHeaderActions?: boolean;
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

  const proposalTemplate = instance.instanceData
    ?.proposalTemplate as ProposalTemplateSchema | null;

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
}: {
  instance: ProcessInstance;
  backHref: string;
  proposal: Proposal;
  isEditMode: boolean;
  asideHeaderIcons?: ReactNode;
  showHeaderActions: boolean;
  collaborationDocId: string;
  proposalTemplate: ProposalTemplateSchema;
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
  const previewTitle = extractPreviewTitle(
    versionPreview?.fragmentContents.title,
  );
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
        title: t('Please complete the following required fields:'),
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
          ? (currentDraft.category ?? undefined)
          : undefined,
        budget: currentDraft.budget ?? undefined,
      };

      await updateProposalMutation.mutateAsync({
        proposalId: proposal.id,
        data: {
          title: currentDraft.title,
          proposalData,
        },
      });

      if (isDraft) {
        await submitProposalMutation.mutateAsync({
          proposalId: proposal.id,
        });
      }

      await Promise.all([
        utils.decision.getProposal.invalidate({
          profileId: proposal.profileId,
        }),
        utils.decision.listProposals.invalidate({
          processInstanceId: instance.id,
        }),
      ]);
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
    >
      <div
        className="sticky top-0 z-10 bg-white"
        onMouseDown={(e) => e.preventDefault()}
      >
        <RichTextEditorToolbar editor={focusedEditor} />
      </div>
      <div className="flex flex-1 flex-col gap-12 py-12">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6">
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
  );
}

function extractPreviewTitle(content: JSONContent | null | undefined): string {
  if (!content) {
    return '';
  }

  if (typeof content.text === 'string') {
    return content.text;
  }

  if (!Array.isArray(content.content)) {
    return '';
  }

  return content.content.map((child) => extractPreviewTitle(child)).join('');
}
