'use client';

import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { Button } from '@op/sense/Button';
import { toast } from '@op/sense/Toast';
import { type ReactNode, useRef, useState } from 'react';
import { LuCheck } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { CollaborativePresence } from '../../collaboration';
import {
  ProposalFormFields,
  ProposalFormProvider,
  useProposalForm,
} from '../proposalEditor/ProposalForm';
import { handleMutationError } from '../proposalEditor/handleMutationError';
import { DevelopProposalFrame } from './DevelopProposalFrame';
import { DevelopProposalSkeleton } from './DevelopProposalSkeleton';

interface DevelopProposalEditorProps {
  instance: ProcessInstance;
  proposal: Proposal;
  backHref: string;
  source: ReactNode;
  sourceLabel: string;
  heading: string;
  description?: string;
}

/**
 * Edits a proposal developed from sources: a draft is advanced, and an advanced
 * entry is saved while the server reports it editable.
 */
export function DevelopProposalEditor({
  instance,
  proposal,
  backHref,
  source,
  sourceLabel,
  heading,
  description,
}: DevelopProposalEditorProps) {
  return (
    <ProposalFormProvider
      instance={instance}
      proposal={proposal}
      isEditMode
      fallback={<DevelopProposalSkeleton />}
    >
      <DevelopProposalFrame
        backHref={backHref}
        actions={
          <DevelopHeaderActions proposal={proposal} backHref={backHref} />
        }
        source={source}
        sourceLabel={sourceLabel}
        heading={heading}
        description={description}
      >
        <ProposalFormFields />
      </DevelopProposalFrame>
    </ProposalFormProvider>
  );
}

function DevelopHeaderActions({
  proposal,
  backHref,
}: {
  proposal: Proposal;
  backHref: string;
}) {
  const {
    state: { isDraft },
  } = useProposalForm();

  return (
    <>
      <CollaborativePresence />
      {isDraft ? (
        <AdvanceButton proposal={proposal} backHref={backHref} />
      ) : (
        <SaveChangesButton backHref={backHref} />
      )}
    </>
  );
}

function AdvanceButton({
  proposal,
  backHref,
}: {
  proposal: Proposal;
  backHref: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const {
    state: { draft },
    actions: { save },
  } = useProposalForm();

  const submitDevelopedProposal =
    trpc.decision.submitDevelopedProposal.useMutation({
      onError: (error) => handleMutationError(error, 'submit', t),
    });

  const { handleSubmit, isSubmitting } = useValidatedSubmit(async () => {
    await save();
    await submitDevelopedProposal.mutateAsync({ proposalId: proposal.id });
    toast.success(
      t('decisions.developEditor.advancedToast', {
        title: draft.title || t('decisions.develop.untitledEntry'),
      }),
    );
    router.push(backHref);
  });

  return (
    <Button onClick={handleSubmit} loading={isSubmitting}>
      <LuCheck className="size-4" />
      {t('decisions.developEditor.advanceAction')}
    </Button>
  );
}

/** Saves an advanced entry, editable until the develop window closes. */
function SaveChangesButton({ backHref }: { backHref: string }) {
  const t = useTranslations();
  const router = useRouter();
  const {
    state: { draft },
    actions: { save },
  } = useProposalForm();

  const { handleSubmit, isSubmitting } = useValidatedSubmit(async () => {
    await save();
    toast.success(
      t('decisions.developEditor.savedToast', {
        title: draft.title || t('decisions.develop.untitledEntry'),
      }),
    );
    router.push(backHref);
  });

  return (
    <Button onClick={handleSubmit} loading={isSubmitting}>
      {t('Save changes')}
    </Button>
  );
}

/** Validates the form, then runs `submit` once at a time. */
function useValidatedSubmit(submit: () => Promise<void>) {
  const t = useTranslations();
  const {
    actions: { validate },
  } = useProposalForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // A ref, not `isSubmitting`: a second click can land before the re-render.
  const inFlightRef = useRef(false);

  const handleSubmit = async () => {
    if (inFlightRef.current) {
      return;
    }

    const result = validate();
    if (!result.valid) {
      toast.error(t('decisions.proposals.validationIssuesHeading'), {
        description: Object.values(result.errors).join(', '),
      });
      return;
    }

    inFlightRef.current = true;
    setIsSubmitting(true);

    try {
      await submit();
    } catch {
      // The mutations' `onError` already logged the failure and showed a toast.
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return { handleSubmit, isSubmitting };
}
