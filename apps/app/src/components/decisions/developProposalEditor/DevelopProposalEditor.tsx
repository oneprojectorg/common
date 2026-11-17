'use client';

import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { Badge } from '@op/sense/Badge';
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
 * Edits a proposal developed from sources. After a draft is advanced the form
 * stays editable for as long as the server reports it editable.
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
  const t = useTranslations();
  const {
    state: { isDraft },
  } = useProposalForm();

  return (
    <>
      <CollaborativePresence />
      {isDraft ? (
        <AdvanceButton proposal={proposal} backHref={backHref} />
      ) : (
        <Badge variant="success">
          {t('decisions.developEditor.advancedStatus')}
        </Badge>
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
    actions: { validate, save },
  } = useProposalForm();
  const [isAdvancing, setIsAdvancing] = useState(false);
  // A ref, not `isAdvancing`: a second click can land before the re-render.
  const advanceInFlightRef = useRef(false);

  const submitDevelopedProposal =
    trpc.decision.submitDevelopedProposal.useMutation({
      onError: (error) => handleMutationError(error, 'submit', t),
    });

  const handleAdvance = async () => {
    if (advanceInFlightRef.current) {
      return;
    }

    const result = validate();
    if (!result.valid) {
      toast.error(t('decisions.proposals.validationIssuesHeading'), {
        description: Object.values(result.errors).join(', '),
      });
      return;
    }

    advanceInFlightRef.current = true;
    setIsAdvancing(true);

    try {
      await save();
      await submitDevelopedProposal.mutateAsync({ proposalId: proposal.id });
      toast.success(
        t('decisions.developEditor.advancedToast', {
          title: draft.title || t('decisions.develop.untitledEntry'),
        }),
      );
      router.push(backHref);
    } catch {
      // The mutations' `onError` already logged the failure and showed a toast.
    } finally {
      advanceInFlightRef.current = false;
      setIsAdvancing(false);
    }
  };

  return (
    <Button onClick={handleAdvance} loading={isAdvancing}>
      <LuCheck className="size-4" />
      {t('decisions.developEditor.advanceAction')}
    </Button>
  );
}
