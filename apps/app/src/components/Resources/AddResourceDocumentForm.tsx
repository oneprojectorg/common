'use client';

import { Button } from '@op/ui/Button';
import { TextField } from '@op/ui/TextField';
import { useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useResourceMutations } from './hooks/useResourceMutations';
import { useResourceUpload } from './hooks/useResourceUpload';

const truncateName = (name: string, max = 50): string =>
  name.length <= max ? name : name.slice(0, max);

const stripExt = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
};

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [touchedTitle, setTouchedTitle] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    reset();
    if (selected) {
      if (!touchedTitle) {
        setTitle(truncateName(stripExt(selected.name)));
      }
      await upload(selected);
    }
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
        <div>
          <label className="mb-1 block text-sm font-semibold text-neutral-black">
            {t('Document')}
          </label>
          <input
            ref={inputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain"
          />
          <Button
            color="secondary"
            size="small"
            onPress={() => inputRef.current?.click()}
            isDisabled={uploading || submitting}
          >
            {uploading
              ? t('Uploading...')
              : file
                ? file.name
                : t('Choose file')}
          </Button>
        </div>
        <TextField
          label={t('Title')}
          value={title}
          onChange={(v) => {
            setTitle(v);
            setTouchedTitle(true);
          }}
          isRequired
          maxLength={50}
          isDisabled={!uploaded}
          inputProps={{ placeholder: t('Add a title') }}
        />
        <TextField
          label={t('Description')}
          value={description}
          onChange={setDescription}
          maxLength={250}
          useTextArea
          isDisabled={!uploaded}
          textareaProps={{ placeholder: t('Add a description') }}
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
