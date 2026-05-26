'use client';

import { Button } from '@op/ui/Button';
import { TextField } from '@op/ui/TextField';
import { cn } from '@op/ui/utils';
import { useRef, useState } from 'react';
import { LuFilePlus2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useResourceMutations } from './hooks/useResourceMutations';
import { useResourceUpload } from './hooks/useResourceUpload';

const ACCEPT_ATTR =
  'image/png,image/jpeg,image/webp,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain';

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
  const { createDocument } = useResourceMutations(profileId);
  const { upload, uploading, uploaded, reset } = useResourceUpload(profileId);

  const [file, setFile] = useState<File | null>(null);
  const [titleInput, setTitleInput] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fileTitle = file ? truncateName(stripExt(file.name)) : '';
  const title = titleInput ?? fileTitle;

  const handleFile = async (selected: File | null) => {
    setFile(selected);
    reset();
    if (selected) {
      await upload(selected);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void handleFile(event.target.files?.[0] ?? null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0] ?? null;
    void handleFile(dropped);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!uploaded || !title.trim()) {
      return;
    }
    createDocument.mutate(
      {
        profileId,
        storageObjectId: uploaded.storageObjectId,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        fileSize: uploaded.fileSize,
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
      },
      {
        onSuccess: () => onSuccess(),
      },
    );
  };

  const submitting = createDocument.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-neutral-black">
            {t('Upload file')}
          </span>
          <input
            ref={inputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept={ACCEPT_ATTR}
          />
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
                ? 'border-primary-teal bg-primary-teal50'
                : 'border-neutral-gray2 hover:border-neutral-gray3',
            )}
          >
            <div className="flex size-20 items-center justify-center rounded-full bg-neutral-gray1 text-neutral-charcoal">
              <LuFilePlus2 className="size-10" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-neutral-black">
                {file ? (
                  truncateName(file.name, 60)
                ) : (
                  <>
                    {t('Drag a file here or ')}
                    <span className="text-primary-teal underline">
                      {t('browse')}
                    </span>
                  </>
                )}
              </p>
              <p className="text-sm text-neutral-gray4">
                {uploading
                  ? t('Uploading...')
                  : t('Accepts PDF, DOCX, XLSX, and images up to {size} MB', {
                      size: MAX_SIZE_MB,
                    })}
              </p>
            </div>
          </div>
        </div>
        <TextField
          label={t('Title')}
          value={title}
          onChange={setTitleInput}
          isRequired
          maxLength={50}
          isDisabled={!uploaded}
          inputProps={{ placeholder: t('Resource name') }}
        />
        <TextField
          label={t('Description')}
          value={description}
          onChange={setDescription}
          maxLength={250}
          useTextArea
          isDisabled={!uploaded}
          textareaProps={{
            placeholder: t('Brief description of this resource'),
          }}
        />
      </div>
      <div className="sticky bottom-0 mt-auto flex shrink-0 gap-4 border-t border-neutral-gray1 bg-white px-4 py-4 sm:px-6">
        <Button
          color="secondary"
          size="small"
          onPress={onCancel}
          isDisabled={submitting}
          className="flex-1 justify-center"
        >
          {t('Cancel')}
        </Button>
        <Button
          type="submit"
          size="small"
          isDisabled={!uploaded || !title.trim() || submitting}
          className="flex-1 justify-center"
        >
          {submitting ? t('Adding...') : t('Add resource')}
        </Button>
      </div>
    </form>
  );
};

const MAX_SIZE_MB = 25;

const truncateName = (name: string, max = 50): string =>
  name.length <= max ? name : `${name.slice(0, max - 1)}…`;

const stripExt = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
};
