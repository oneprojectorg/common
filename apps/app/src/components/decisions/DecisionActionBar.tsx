'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { RichTextViewer } from '@op/ui/RichTextEditor';
import { toast } from '@op/ui/Toast';
import he from 'he';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n/routing';

import { getViewerExtensions } from '../RichTextEditor/editorConfig';

export const DecisionActionBar = ({
  instanceId,
  description,
  markup = false,
  showSubmitButton = false,
}: {
  instanceId: string;
  description?: string;
  markup?: boolean;
  showSubmitButton?: boolean;
}) => {
  const t = useTranslations();
  const { slug } = useParams();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const createProposalMutation = trpc.decision.createProposal.useMutation({
    onSuccess: (proposal) => {
      // Navigate to edit the newly created draft proposal
      router.push(`/decisions/${slug}/proposal/${proposal.profileId}/edit`);
    },
    onError: (error) => {
      setIsCreating(false);
      toast.error({
        title: t('Failed to create proposal'),
        message: error.message,
      });
    },
  });

  const handleCreateProposal = () => {
    setIsCreating(true);
    createProposalMutation.mutate({
      processInstanceId: instanceId,
      proposalData: {}, // Empty draft - user will fill in via edit page
    });
  };

  return (
    <div className="flex w-full justify-center">
      <div className="flex w-full max-w-[12rem] flex-col items-center justify-center gap-4 sm:flex-row">
        {description ? (
          <DialogTrigger>
            <Button color="secondary" className="w-full">
              {t('About the process')}
            </Button>

            <Modal isDismissable>
              <Dialog>
                <ModalHeader>{t('About the process')}</ModalHeader>
                <ModalBody>
                  {markup && description ? (
                    <div
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
            {t('Submit a proposal')}
          </Button>
        )}
      </div>
    </div>
  );
};
