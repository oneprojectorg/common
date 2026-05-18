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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
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
          onPress={() => inputRef.current?.click()}
          isDisabled={uploading || submitting}
        >
          {uploading ? t('Uploading...') : file ? file.name : t('Choose file')}
        </Button>
      </div>
      <TextField
        label={t('Title')}
        value={title}
        onChange={(v) => {
          setTitle(v);
          setTouchedTitle(true);
        }}
        maxLength={50}
        isDisabled={!uploaded}
      />
      <TextField
        label={t('Description')}
        value={description}
        onChange={setDescription}
        maxLength={250}
        useTextArea
        isDisabled={!uploaded}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button color="secondary" onPress={onCancel} isDisabled={submitting}>
          {t('Cancel')}
        </Button>
        <Button
          type="submit"
          isDisabled={!uploaded || !title.trim() || submitting}
        >
          {submitting ? t('Saving...') : t('Save')}
        </Button>
      </div>
    </form>
  );
};
