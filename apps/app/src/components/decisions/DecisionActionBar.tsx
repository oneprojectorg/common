'use client';

import { trpc } from '@op/api/client';
import { createSBBrowserClient } from '@op/supabase/client';
import { Button } from '@op/ui/Button';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { RichTextViewer } from '@op/ui/RichTextEditor';
import { toast } from '@op/ui/Toast';
import he from 'he';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import { getViewerExtensions } from '../RichTextEditor/editorConfig';

export const DecisionActionBar = ({
  instanceId,
  description,
  label,
  markup = false,
  showSubmitButton = false,
  publicProposalFlow = false,
}: {
  instanceId: string;
  description?: string;
  label?: string;
  markup?: boolean;
  showSubmitButton?: boolean;
  publicProposalFlow?: boolean;
}) => {
  const t = useTranslations();
  const { slug } = useParams();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const supabase = createSBBrowserClient();

  const createProposalMutation = trpc.decision.createProposal.useMutation();
  const createPublicProposalMutation =
    trpc.decision.createPublicProposal.useMutation();

  const handleCreateProposal = async () => {
    setIsCreating(true);

    try {
      // Empty draft — the user fills it in via the edit page.
      const input = { processInstanceId: instanceId, proposalData: {} };

      let proposal;
      if (publicProposalFlow) {
        // The public endpoint joins the instance server-side, so ensure the
        // visitor has at least an anonymous session to identify them.
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          const { error } = await supabase.auth.signInAnonymously();
          if (error) {
            throw error;
          }
        }

        proposal = await createPublicProposalMutation.mutateAsync(input);
      } else {
        proposal = await createProposalMutation.mutateAsync(input);
      }

      router.push(`/decisions/${slug}/proposal/${proposal.profileId}/edit`);
    } catch (error) {
      setIsCreating(false);
      toast.error({
        title: t('Failed to create proposal'),
        message: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <div className="flex w-full justify-center">
      <div className="flex w-full max-w-[12rem] flex-col items-center justify-center gap-4 sm:flex-row">
        {description ? (
          <DialogTrigger>
            <Button color="secondary" className="w-full">
              {label ?? t('Learn more')}
            </Button>

            <Modal isDismissable>
              <Dialog>
                <ModalHeader>{label ?? t('About the process')}</ModalHeader>
                <ModalBody>
                  {markup && description ? (
                    <div
                      dir="auto"
                      className="prose max-w-none prose-gray"
                      dangerouslySetInnerHTML={{
                        __html: he.decode(description),
                      }}
                    />
                  ) : (
                    <RichTextViewer
                      extensions={getViewerExtensions()}
                      content={description}
                      editorClassName="prose prose-base max-w-none [&_p]:text-base"
                    />
                  )}
                </ModalBody>
              </Dialog>
            </Modal>
          </DialogTrigger>
        ) : null}

        {showSubmitButton && (
          <Button
            color="primary"
            className="w-full"
            isDisabled={isCreating}
            onPress={handleCreateProposal}
          >
            {isCreating ? <LoadingSpinner /> : null}
            {t('Start a proposal')}
          </Button>
        )}
      </div>
    </div>
  );
};
