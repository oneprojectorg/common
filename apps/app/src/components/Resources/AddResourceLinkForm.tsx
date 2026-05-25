'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { TextField } from '@op/ui/TextField';
import { useEffect, useState } from 'react';
import { LuLink } from 'react-icons/lu';

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
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:px-6">
        <TextField
          label={t('URL')}
          value={url}
          onChange={(v) => {
            setUrl(v);
            if (urlError) {
              setUrlError(undefined);
            }
          }}
          isRequired
          inputProps={{
            type: 'url',
            placeholder: 'https://',
            icon: <LuLink className="size-4 text-neutral-gray4" />,
          }}
          errorMessage={urlError}
        />
        <TextField
          label={t('Title')}
          value={title}
          onChange={(v) => {
            setTitle(v);
            setTouchedTitle(true);
          }}
          isRequired
          maxLength={50}
          inputProps={{ placeholder: t('Add a title') }}
        />
        <TextField
          label={t('Description')}
          value={description}
          onChange={setDescription}
          maxLength={250}
          useTextArea
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
          isDisabled={!urlValid || !title.trim() || submitting}
          className="flex-1 justify-center"
        >
          {submitting ? t('Adding...') : t('Add resource')}
        </Button>
      </div>
    </form>
  );
};
