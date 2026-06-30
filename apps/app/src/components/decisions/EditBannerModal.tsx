'use client';

import { BannerImageField } from '@op/ui/BannerImageField';
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
  const {
    previewUrl,
    fileName,
    fileSizeLabel,
    upload,
    remove,
    isUploading,
    isRemoving,
    uploadError,
  } = useOverviewBackgroundImage({
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
          <BannerImageField
            label={t('Banner image')}
            value={previewUrl}
            fileName={fileName}
            fileSizeLabel={fileSizeLabel}
            title={t('Upload banner image')}
            description={t('PNG or JPG · recommended 2400×800px · max 3MB')}
            helperText={t(
              'The headline appears centered over a dark overlay. Avoid images with key subjects in the middle.',
            )}
            chooseFileLabel={t('Choose file')}
            removeLabel={t('Remove image')}
            onSelectFile={upload}
            onRemove={remove}
            uploading={isUploading || isRemoving}
            error={uploadError || undefined}
          />
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
