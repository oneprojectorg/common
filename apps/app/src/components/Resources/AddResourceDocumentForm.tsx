'use client';

import { trpc } from '@op/api/client';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_RESOURCE_FILE_SIZE,
  RESOURCE_DESCRIPTION_MAX_LEN,
  RESOURCE_TITLE_MAX_LEN,
  isAllowedUploadMimeType,
} from '@op/common/client';
import { Button } from '@op/sense/Button';
import { Field, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import { Skeleton } from '@op/sense/Skeleton';
import { Spinner } from '@op/sense/Spinner';
import { Textarea } from '@op/sense/Textarea';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LuFilePlus2, LuFileText, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useResourceUpload } from './hooks/useResourceUpload';
import { getExtension, stripExtension, truncateName } from './utils';

const ACCEPT_ATTR = ALLOWED_UPLOAD_MIME_TYPES.join(',');
const MAX_SIZE_MB = MAX_RESOURCE_FILE_SIZE / 1024 / 1024;

export const AddResourceDocumentForm = ({
  profileId,
  onSuccess,
  onCancel,
}: {
  profileId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) => {
  const t = useTranslations();
  const createDocument = trpc.resources.createDocument.useMutation({
    onSuccess: () => toast.success(t('Resource added')),
    onError: () => toast.error(t('Could not add resource')),
  });
  const { upload, uploading, uploaded, reset } = useResourceUpload(profileId);

  const [file, setFile] = useState<File | null>(null);
  const [titleInput, setTitleInput] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fileTitle = file ? truncateName(stripExtension(file.name)) : '';
  const title = titleInput ?? fileTitle;
  const isImage = file?.type.startsWith('image/') ?? false;

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileSelected = async (selected: File | null) => {
    // Backend is the security boundary (mime + size both rechecked against
    // storage object metadata in createDocument). These guards are UX only:
    // fail fast before we burn bandwidth uploading a file that will be
    // rejected.
    if (selected) {
      if (!isAllowedUploadMimeType(selected.type)) {
        toast.error(t('Unsupported file type'));
        return;
      }
      if (selected.size > MAX_RESOURCE_FILE_SIZE) {
        toast.error(
          t('File is too large (max {size} MB)', {
            size: MAX_SIZE_MB,
          }),
        );
        return;
      }
    }
    setFile(selected);
    reset();
    if (selected) {
      await upload(selected);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setTitleInput(null);
    reset();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void handleFileSelected(event.target.files?.[0] ?? null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0] ?? null;
    void handleFileSelected(dropped);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!uploaded || !title.trim()) {
      return;
    }
    // handleFileSelected already gated on the allowlist; this guard is a
    // type-narrow so the tRPC input enum type is satisfied without a cast.
    if (!isAllowedUploadMimeType(uploaded.mimeType)) {
      return;
    }
    // Use the profileId returned by uploadFile (not the prop), so collection
    // flows with M:N profile membership submit metadata against the same
    // profile the storage object is namespaced under.
    createDocument.mutate(
      {
        target: { kind: 'profile', profileId: uploaded.profileId },
        storagePath: uploaded.storagePath,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
      },
      { onSuccess },
    );
  };

  const submitting = createDocument.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-neutral-black">{t('Upload file')}</span>
          <input
            ref={inputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept={ACCEPT_ATTR}
          />
          {file ? (
            isImage ? (
              <div className="relative h-44 w-full overflow-hidden rounded-lg border border-neutral-gray1 bg-neutral-offWhite">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : null}
                {uploading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <Spinner className="size-6" />
                  </div>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={uploading}
                  className="absolute end-2 top-2 bg-white/90 shadow-sm hover:bg-white"
                  aria-label={t('Remove file')}
                >
                  <LuX className="size-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-4 rounded-lg border border-neutral-gray1 bg-white p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-tealWhite">
                  <LuFileText className="size-5 text-neutral-gray4" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  {uploading ? (
                    <>
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="mt-1 h-3 w-20" />
                    </>
                  ) : (
                    <>
                      <span className="truncate text-base font-medium text-neutral-charcoal">
                        {file.name}
                      </span>
                      <span className="text-sm text-neutral-gray4">
                        {fileMetaLabel(file)}
                      </span>
                    </>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={uploading}
                  className="shrink-0"
                  aria-label={t('Remove file')}
                >
                  <LuX className="size-5" />
                </Button>
              </div>
            )
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'flex min-h-52 cursor-pointer flex-col items-center justify-center gap-6 rounded-lg border border-dashed bg-neutral-offWhite px-12 py-6 text-center transition-colors',
                isDragging
                  ? 'bg-primary-teal50 border-primary-teal'
                  : 'border-neutral-gray2 hover:border-neutral-gray3',
              )}
            >
              <div className="flex size-20 items-center justify-center rounded-full bg-neutral-gray1 text-neutral-charcoal">
                <LuFilePlus2 className="size-10" />
              </div>
              <div className="flex flex-col gap-2 text-base">
                <p className="text-neutral-black">
                  {t.rich('Drag a file here or <browse>browse</browse>', {
                    browse: (chunks: ReactNode) => (
                      <span className="text-primary-teal underline">
                        {chunks}
                      </span>
                    ),
                  })}
                </p>
                <p className="text-neutral-gray4">
                  {t('Accepts PDF, DOCX, XLSX, and images up to {size} MB', {
                    size: MAX_SIZE_MB,
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
        <Field>
          <FieldLabel htmlFor="document-title">
            {t('Title')}
            <RequiredAsterisk />
          </FieldLabel>
          <Input
            id="document-title"
            value={title}
            onChange={(event) => setTitleInput(event.target.value)}
            required
            maxLength={RESOURCE_TITLE_MAX_LEN}
            disabled={!uploaded}
            placeholder={t('Resource name')}
            className="[unicode-bidi:plaintext]"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="document-description">
            {t('Description')}
          </FieldLabel>
          <Textarea
            id="document-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={RESOURCE_DESCRIPTION_MAX_LEN}
            disabled={!uploaded}
            placeholder={t('Brief description of this resource')}
            className="[unicode-bidi:plaintext]"
          />
        </Field>
      </div>
      <div className="sticky bottom-0 flex shrink-0 gap-2 bg-white px-4 py-4 sm:px-6">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 justify-center"
        >
          {t('Cancel')}
        </Button>
        <Button
          type="submit"
          disabled={!uploaded || !title.trim() || submitting}
          className="flex-1 justify-center"
        >
          {submitting ? t('Adding...') : t('Add resource')}
        </Button>
      </div>
    </form>
  );
};

const fileMetaLabel = (file: File): string => {
  const ext = getExtension(file.name);
  const sizeLabel = formatFileSize(file.size);
  return ext ? `${ext} • ${sizeLabel}` : sizeLabel;
};

// Inlined from @op/ui utils (no @op/sense equivalent — sense keeps this helper
// private to MediaDisplay). Same formatting the rest of the app used.
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
};
