'use client';

import { BannerImageField } from '@op/ui/BannerImageField';
import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';

import { useRouter, useTranslations } from '@/lib/i18n';

import { useOverviewBackgroundImage } from './useOverviewBackgroundImage';

/**
 * Controlled modal for uploading/removing the overview hero background image.
 * Shared by the desktop "Edit banner" button and the mobile admin bottom sheet.
 * The overview page is RSC-fed, so a change triggers router.refresh().
 */
export function BannerUploadModal({
  instanceId,
  backgroundImagePath,
  isOpen,
  onOpenChange,
}: {
  instanceId: string;
  /** Stored storage path of the current background, if any. */
  backgroundImagePath?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
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
    <Modal isDismissable isOpen={isOpen} onOpenChange={onOpenChange}>
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
        <Button color="secondary" onPress={() => onOpenChange(false)}>
          {t('Done')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
