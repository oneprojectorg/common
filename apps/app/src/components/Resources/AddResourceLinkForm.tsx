'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { TextField } from '@op/ui/TextField';
import { useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useResourceMutations } from './hooks/useResourceMutations';

const isValidUrl = (value: string): boolean => {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

export const AddResourceLinkForm = ({
  profileId,
  onSuccess,
  onCancel,
}: {
  profileId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) => {
  const t = useTranslations();
  const { createLink } = useResourceMutations(profileId);

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [touchedTitle, setTouchedTitle] = useState(false);
  const [urlError, setUrlError] = useState<string | undefined>();

  const urlValid = isValidUrl(url);

  const previewQuery = trpc.content.linkPreview.useQuery(
    { url },
    { enabled: urlValid, retry: false, staleTime: 60 * 1000 },
  );

  useEffect(() => {
    if (!touchedTitle && previewQuery.data?.meta?.title) {
      setTitle(previewQuery.data.meta.title.slice(0, 50));
    }
  }, [previewQuery.data, touchedTitle]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!urlValid) {
      setUrlError(t('Enter a valid URL'));
      return;
    }
    if (!title.trim()) {
      return;
    }
    createLink.mutate(
      {
        profileId,
        linkUrl: url,
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
      },
      {
        onSuccess: () => onSuccess(),
      },
    );
  };

  const submitting = createLink.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <TextField
        label={t('URL')}
        value={url}
        onChange={(v) => {
          setUrl(v);
          if (urlError) {
            setUrlError(undefined);
          }
        }}
        inputProps={{ type: 'url', placeholder: 'https://' }}
        errorMessage={urlError}
      />
      <TextField
        label={t('Title')}
        value={title}
        onChange={(v) => {
          setTitle(v);
          setTouchedTitle(true);
        }}
        maxLength={50}
      />
      <TextField
        label={t('Description')}
        value={description}
        onChange={setDescription}
        maxLength={250}
        useTextArea
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button color="secondary" onPress={onCancel} isDisabled={submitting}>
          {t('Cancel')}
        </Button>
        <Button
          type="submit"
          isDisabled={!urlValid || !title.trim() || submitting}
        >
          {submitting ? t('Saving...') : t('Save')}
        </Button>
      </div>
    </form>
  );
};
