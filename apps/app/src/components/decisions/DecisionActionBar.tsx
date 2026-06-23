'use client';

import { Button } from '@op/ui/Button';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { RichTextViewer } from '@op/ui/RichTextEditor';
import he from 'he';
import { useParams } from 'next/navigation';

import { useTranslations } from '@/lib/i18n';

import { getViewerExtensions } from '../RichTextEditor/editorConfig';
import { useCreateProposal } from './useCreateProposal';

export const DecisionActionBar = ({
  instanceId,
  description,
  label,
  markup = false,
  showSubmitButton = false,
}: {
  instanceId: string;
  description?: string;
  label?: string;
  markup?: boolean;
  showSubmitButton?: boolean;
}) => {
  const t = useTranslations();
  const { slug } = useParams<{ slug: string }>();

  const {
    createProposal: handleCreateProposal,
    isCreating,
    isReady,
  } = useCreateProposal({
    instanceId,
    navigateTo: (proposal) =>
      `/decisions/${slug}/proposal/${proposal.profileId}/edit`,
  });

  return (
    <div className="flex w-full justify-center">
      <div className="flex w-full max-w-[12rem] flex-col items-center justify-center gap-4 sm:flex-row">
        {description ? (
          <DialogTrigger>
            <Button color="secondary" className="w-full">
              {label ?? t('Learn more')}
            </Button>

            <Modal isDismissable className="sm:max-w-3xl">
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
            isDisabled={!isReady || isCreating}
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
