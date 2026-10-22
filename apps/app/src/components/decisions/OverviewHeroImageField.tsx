'use client';

import { IMAGE_UPLOAD_SIZE_LIMIT } from '@op/common/client';
import { BannerImageField } from '@op/sense/BannerImageField';
import Image from 'next/image';

import { useTranslations } from '@/lib/i18n';

import { useOverviewHeroImage } from './useOverviewHeroImage';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

/**
 * App-side wrapper around the @op/sense BannerImageField for a decision overview's
 * hero image. Owns the upload hook, the translated copy, and the optimized
 * `next/image` preview so call sites stay a two/three-prop affair. Shared by
 * the Process Builder Overview tab and the live overview's "Edit banner" modal.
 */
export function OverviewHeroImageField({
  instanceId,
  initialPath,
  onChange,
}: {
  instanceId: string;
  /** Stored storage path of the current hero image, if any. */
  initialPath?: string;
  /** Fires after a successful upload/remove (e.g. to refresh an RSC page). */
  onChange?: () => void;
}) {
  const t = useTranslations('decisions.processBuilder');
  const {
    previewUrl,
    fileName,
    fileSizeLabel,
    upload,
    remove,
    isUploading,
    isRemoving,
    uploadError,
  } = useOverviewHeroImage({ instanceId, initialPath, onChange });

  return (
    <BannerImageField
      value={previewUrl}
      fileName={fileName}
      fileSizeLabel={fileSizeLabel}
      accept={ACCEPT}
      copy={{
        label: t('bannerImageLabel'),
        title: t('bannerImageUploadAction'),
        description: t('bannerImageFormatHint', {
          size: Math.floor(IMAGE_UPLOAD_SIZE_LIMIT / 1024 / 1024),
        }),
        helperText: t('bannerImageCompositionHint'),
        chooseFile: t('bannerImageChooseFile'),
        remove: t('bannerImageRemove'),
      }}
      onSelectFile={upload}
      onRemove={remove}
      uploading={isUploading || isRemoving}
      error={uploadError || undefined}
      renderPreview={({ src, className }) => (
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 640px) 40rem, 100vw"
          className={className}
        />
      )}
    />
  );
}
