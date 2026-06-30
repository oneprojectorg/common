'use client';

import { BannerUploader } from '@op/ui/BannerUploader';
import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { useState } from 'react';
import { LuImage } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { useOverviewBackgroundImage } from './useOverviewBackgroundImage';

/**
 * Admin-only "Edit banner" control on the live overview hero. Renders the
 * button and a modal that uploads/removes the hero background image. The
 * underlying page is RSC-fed, so a change triggers router.refresh() to re-read
 * the new image.
 */
export function EditBannerModal({
  instanceId,
  backgroundImagePath,
}: {
  instanceId: string;
  /** Stored storage path of the current background, if any. */
  backgroundImagePath?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { previewUrl, upload, remove, isUploading, isRemoving, uploadError } =
    useOverviewBackgroundImage({
      instanceId,
      initialPath: backgroundImagePath,
      onChange: () => router.refresh(),
    });

  return (
    <>
      <Button
        color="secondary"
        size="small"
        className="absolute top-4 right-4 z-10"
        onPress={() => setIsOpen(true)}
      >
        <LuImage className="size-4" aria-hidden="true" />
        {t('Edit banner')}
      </Button>
      <Modal isDismissable isOpen={isOpen} onOpenChange={setIsOpen}>
        <ModalHeader>{t('Edit banner')}</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <BannerUploader
              value={previewUrl}
              onChange={upload}
              uploading={isUploading}
              error={uploadError || undefined}
            />
            {previewUrl ? (
              <Button
                color="secondary"
                className="w-auto self-end"
                isDisabled={isRemoving}
                onPress={remove}
              >
                {t('Remove image')}
              </Button>
            ) : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onPress={() => setIsOpen(false)}>
            {t('Done')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
