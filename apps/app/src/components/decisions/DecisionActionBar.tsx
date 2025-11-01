'use client';

import { Button } from '@op/ui/Button';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import he from 'he';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n/routing';

import { RichTextEditorContent } from '../RichTextEditor';

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
  const [isNavigating, setIsNavigating] = useState(false);

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
                      className="prose prose-gray max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: he.decode(description),
                      }}
                    />
                  ) : (
                    <RichTextEditorContent
                      content={description}
                      readOnly={true}
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
            isDisabled={isNavigating}
            onPress={() => {
              setIsNavigating(true);
              router.push(
                `/profile/${slug}/decisions/${instanceId}/proposal/create`,
              );
            }}
          >
            {isNavigating ? <LoadingSpinner /> : null}
            {t('Submit a proposal')}
          </Button>
        )}
      </div>
    </div>
  );
};
