'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { DATE_TIME_UTC_FORMAT, formatDate } from '@/utils/formatting';
import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { logger } from '@op/logging/client';
import { Alert, AlertDescription, AlertTitle } from '@op/sense/Alert';
import { Header2 } from '@op/sense/Header';
import { toast } from '@op/sense/Toast';
import { useLocale } from 'next-intl';
import { usePostHog } from 'posthog-js/react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import {
  CollaborativePresence,
  useCollaborativeDoc,
} from '../../collaboration';
import { ProposalAttachments } from '../ProposalAttachments';
import { ProposalEditorLayout } from '../ProposalEditorLayout';
import { ProposalEditorSkeleton } from '../ProposalEditorSkeleton';
import { ProposalInfoModal } from '../ProposalInfoModal';
import { CustomFormModal, type CustomFormValues } from './CustomFormModal';
import {
  ProposalFormFields,
  ProposalFormProvider,
  useProposalForm,
} from './ProposalForm';
import { SubmitProposalConfirmModal } from './SubmitProposalConfirmModal';
import { useOptionalVersionPreview } from './VersionPreviewContext';
import { handleMutationError } from './handleMutationError';
import { getFragmentText } from './proposalPreviewContent';
import { requiresSubmitConfirmation } from './submitConfirmation';

export function ProposalEditor({
  instance,
  backHref,
  proposal,
  isEditMode = false,
  asideHeaderIcons,
}: {
  instance: ProcessInstance;
  backHref: string;
  proposal: Proposal;
  isEditMode?: boolean;
  asideHeaderIcons?: ReactNode;
}) {
  return (
    <ProposalFormProvider
      instance={instance}
      proposal={proposal}
      isEditMode={isEditMode}
      fallback={<ProposalEditorSkeleton />}
    >
      <ProposalEditorInner
        instance={instance}
        backHref={backHref}
        proposal={proposal}
        isEditMode={isEditMode}
        asideHeaderIcons={asideHeaderIcons}
      />
    </ProposalFormProvider>
  );
}

/**
 * The edit page around the proposal form: header, presence, attachments, the
 * info modal and the submission flow.
 */
function ProposalEditorInner({
  instance,
  backHref,
  proposal,
  isEditMode,
  asideHeaderIcons,
}: {
  instance: ProcessInstance;
  backHref: string;
  proposal: Proposal;
  isEditMode: boolean;
  asideHeaderIcons?: ReactNode;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const { user } = useRequiredUser();
  const utils = trpc.useUtils();
  const posthog = usePostHog();

  // Anon visitors get sent back with ?promote=1 so PromoteAccountModal offers an
  // upgrade. `isAnonymous` is session-derived, not the stale DB relation.
  const isAnonymous = Boolean(user?.isAnonymous);
  const versionPreview = useOptionalVersionPreview();
  const { isAccessDenied } = useCollaborativeDoc();
  const {
    state: { draft, isDraft },
    actions: { validate, save },
  } = useProposalForm();

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomFormModal, setShowCustomFormModal] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const isPreviewMode = Boolean(versionPreview);
  const submitInFlightRef = useRef(false);

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

  const previewTitle = getFragmentText(versionPreview?.fragmentContents.title);
  const viewingLabel = versionPreview?.tiptapVersion
    ? t('decisions.proposals.viewingVersionDate', {
        date: formatDate(
          new Date(versionPreview.tiptapVersion.date).toISOString(),
          locale,
          DATE_TIME_UTC_FORMAT,
        ),
      })
    : null;

  // -- Mutations -------------------------------------------------------------

  const submitProposalMutation = trpc.decision.submitProposal.useMutation({
    onSuccess: () =>
      posthog.capture(
        'proposal_submission_confirmed',
        getDecisionCommonProperties({
          decisionInstanceId: proposal.processInstanceId,
          proposalId: proposal.id,
        }),
      ),
    onError: (error) => handleMutationError(error, 'submit', t),
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

  const performSubmit = useCallback(async () => {
    // A ref, not `isSubmitting`: the confirm dialog's action button is a plain
    // Button that stays clickable through its exit animation, and state read at
    // render time would still be `false` for a second click in that window.
    if (submitInFlightRef.current) {
      return;
    }
    submitInFlightRef.current = true;

    setIsSubmitting(true);

    try {
      await save();

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
        context: 'ProposalEditor.performSubmit',
      });
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    save,
    isDraft,
    instance.profileId,
    instance.currentStateId,
    initialPhaseId,
    utils,
    finalizeSubmit,
  ]);

  // -- Client-side schema validation (validates ALL template fields) ----------
  const validateWithToast = useCallback(() => {
    const result = validate();
    if (result.valid) {
      return true;
    }

    toast.error(t('decisions.proposals.validationIssuesHeading'), {
      description: Object.values(result.errors).join(', '),
    });

    return false;
  }, [t, validate]);

  const handleSubmitProposal = useCallback(() => {
    // Validation runs ahead of the confirmation so an incomplete draft gets its
    // errors instead of a prompt about a submission it can't reach.
    if (!validateWithToast()) {
      return;
    }

    if (requiresSubmitConfirmation({ instance, isDraft })) {
      setShowSubmitConfirm(true);
      return;
    }

    void performSubmit();
  }, [validateWithToast, instance, isDraft, performSubmit]);

  const handleConfirmSubmit = useCallback(() => {
    // The dialog closes before the submission starts: `AlertDialogAction` is a
    // plain Button, so nothing dismisses it for us, and leaving it open would
    // stack it under `CustomFormModal` and outlive the redirect.
    setShowSubmitConfirm(false);

    // Re-validated because the document is collaborative: a co-author can empty
    // a required field while the dialog sits open.
    if (!validateWithToast()) {
      return;
    }

    void performSubmit();
  }, [validateWithToast, performSubmit]);

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

  const editorBody = (
    <>
      <ProposalFormFields />

      <div className="border-t pt-6 sm:pt-10">
        <ProposalAttachments
          proposalId={proposal.id}
          attachments={
            proposal.attachments?.map((pa) => ({
              id: pa.attachmentId,
              fileName:
                pa.attachment?.fileName ??
                t('decisions.proposals.unknownAuthor'),
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
    >
      {/* Formatting is per-field now: each prose editor renders its own bubble
          menu on the selection, so there is no toolbar row above the form. */}
      <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[1fr]">
        <div className="relative min-h-0 overflow-y-auto">
          <div className="px-4 py-8 sm:px-6 sm:py-14">
            <div className="mx-auto flex w-full max-w-136 flex-col gap-6 sm:gap-10">
              <Header2>
                {isEditMode
                  ? t('decisions.proposals.editProposalTitle')
                  : t('decisions.proposals.createProposalTitle')}
              </Header2>
              {isAccessDenied && (
                <Alert variant="warning">
                  <AlertTitle>
                    {t('decisions.proposals.editingClosedTitle')}
                  </AlertTitle>
                  <AlertDescription>
                    {t('decisions.proposals.editingClosedDescription')}
                  </AlertDescription>
                </Alert>
              )}
              {editorBody}
            </div>
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

      <SubmitProposalConfirmModal
        isOpen={showSubmitConfirm}
        onOpenChange={setShowSubmitConfirm}
        onConfirm={handleConfirmSubmit}
      />

      {customForm && (
        <CustomFormModal
          isOpen={showCustomFormModal}
          customFormId={customForm.id}
          schema={customForm.schema}
          isSubmitting={isSubmitting}
          onSubmit={handleCustomFormSubmit}
          onOpenChange={handleCustomFormOpenChange}
          submitLabel={t('decisions.proposals.submitIdeaAction')}
        />
      )}
    </ProposalEditorLayout>
  );
}
