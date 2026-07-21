'use client';

import * as React from 'react';
import { LuImagePlus, LuTrash2 } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';

/**
 * All user-facing copy, grouped into one prop so the component stays
 * i18n-agnostic (this package can't call the app's translation hook) without
 * spraying six string props across every call site.
 */
interface BannerImageCopy {
  /** Field label shown above the field (e.g. "Banner image"). */
  label?: string;
  /** Title in the empty state (e.g. "Upload banner image"). */
  title?: string;
  /** Specs line in the empty state (e.g. "PNG or JPG · max 25MB"). */
  description?: string;
  /** Helper text shown below the empty state. */
  helperText?: string;
  /** Label of the choose-file button (e.g. "Choose file"). */
  chooseFile?: string;
  /** Accessible label for the remove button in the filled state. */
  remove?: string;
}

const DEFAULT_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

interface BannerImageFieldProps {
  /** Current image URL; presence switches the field to its filled state. */
  value?: string | null;
  /** Display name of the current file (filled state). */
  fileName?: string;
  /** Preformatted size label of the current file, e.g. "1.2 MB". */
  fileSizeLabel?: string;
  copy?: BannerImageCopy;
  /** Accepted file types for the picker (the file input `accept`). */
  accept?: string;
  /** Tailwind aspect-ratio class for the preview box. */
  aspectClassName?: string;
  onSelectFile?: (file: File) => void;
  onRemove?: () => void;
  uploading?: boolean;
  error?: string | null;
  /**
   * Renders the preview for stable URLs (e.g. next/image). Transient
   * blob:/data: URLs always render on a plain <img>.
   */
  renderPreview?: (props: {
    src: string;
    className: string;
  }) => React.ReactNode;
  className?: string;
}

function BannerImageField({
  value,
  fileName,
  fileSizeLabel,
  copy,
  accept = DEFAULT_ACCEPT,
  aspectClassName = 'aspect-[3/1]',
  onSelectFile,
  onRemove,
  uploading = false,
  error = null,
  renderPreview,
  className,
}: BannerImageFieldProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onSelectFile) {
      onSelectFile(file);
    }
    // Reset so selecting the same file again still fires change.
    event.target.value = '';
  };

  const previewClassName = cn(
    'size-full object-cover',
    uploading && 'opacity-20',
  );
  // The optimistic frame is a local object/data URL next/image can't
  // optimize; keep it on a plain <img> and only hand stable URLs to
  // renderPreview.
  const isTransient =
    !!value && (value.startsWith('blob:') || value.startsWith('data:'));

  return (
    <div
      data-slot="banner-image-field"
      className={cn('flex w-full flex-col gap-2', className)}
    >
      {copy?.label ? <p className="text-sm">{copy.label}</p> : null}

      {value ? (
        <div className="flex flex-col gap-2">
          <div
            className={cn(
              'relative w-full overflow-hidden rounded-lg',
              aspectClassName,
            )}
          >
            {renderPreview && !isTransient ? (
              renderPreview({ src: value, className: previewClassName })
            ) : (
              <img src={value} alt="" className={previewClassName} />
            )}
            {uploading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner />
              </div>
            ) : null}
            {/* Disabled while a request is in flight so a remove can't race
                the in-progress upload/record (or fire a second remove). */}
            <button
              type="button"
              onClick={() => onRemove?.()}
              disabled={uploading}
              aria-label={copy?.remove ?? 'Remove'}
              className="absolute end-2 top-2 cursor-pointer rounded-md border bg-background p-2 text-foreground shadow-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            >
              <LuTrash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
          {fileName ? (
            <p className="text-sm text-muted-foreground">
              {fileName}
              {fileSizeLabel ? ` · ${fileSizeLabel}` : null}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col justify-between gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:p-6">
          <div className="flex gap-4">
            <div className="flex w-32 items-center justify-center rounded-md bg-gray-100">
              {uploading ? (
                <Spinner />
              ) : (
                <LuImagePlus
                  className="size-4 text-foreground"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="flex flex-col">
              {copy?.title ? (
                <span className="text-base">{copy.title}</span>
              ) : null}
              {copy?.description ? (
                <span className="text-sm text-muted-foreground">
                  {copy.description}
                </span>
              ) : null}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="w-auto sm:w-fit"
          >
            {copy?.chooseFile ?? 'Choose file'}
          </Button>
        </div>
      )}

      {copy?.helperText && !value ? (
        <p className="text-sm text-muted-foreground">{copy.helperText}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
      />
    </div>
  );
}

export { BannerImageField, type BannerImageCopy };
