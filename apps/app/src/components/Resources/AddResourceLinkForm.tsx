'use client';

import { trpc } from '@op/api/client';
import { httpUrlSchema } from '@op/common/client';
import { useDebounce } from '@op/hooks';
import { Button } from '@op/ui/Button';
import { TextField } from '@op/ui/TextField';
import { useState } from 'react';
import { LuLink } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useResourceMutations } from './hooks/useResourceMutations';

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
  const [titleInput, setTitleInput] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [urlError, setUrlError] = useState<string | undefined>();

  // Mirror the profile-edit website field: bare domains like "example.com"
  // submit as "https://example.com". Validation runs against the normalized
  // form so the preview query and the API see the same URL.
  const normalizedUrl = normalizeHttpUrl(url);
  const urlValid =
    normalizedUrl !== null && httpUrlSchema.safeParse(normalizedUrl).success;

  // Debounce the preview query so we don't hammer Iframely on every keystroke.
  const [debouncedUrl] = useDebounce(normalizedUrl, 400);
  const debouncedValid =
    debouncedUrl !== null && httpUrlSchema.safeParse(debouncedUrl).success;

  const previewQuery = trpc.content.linkPreview.useQuery(
    { url: debouncedUrl ?? '' },
    { enabled: debouncedValid, retry: false, staleTime: 60 * 1000 },
  );

  const previewTitle = previewQuery.data?.meta?.title?.slice(0, 50) ?? '';
  const fallbackTitle = urlValid ? hostnameFromUrl(normalizedUrl) : '';
  const title = titleInput ?? (previewTitle || fallbackTitle);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!urlValid || normalizedUrl === null) {
      setUrlError(t('Enter a valid URL'));
      return;
    }
    if (!title.trim()) {
      return;
    }
    createLink.mutate(
      {
        target: { kind: 'profile', profileId },
        linkUrl: normalizedUrl,
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
            type: 'text',
            inputMode: 'url',
            autoCapitalize: 'off',
            autoCorrect: 'off',
            spellCheck: false,
            placeholder: 'https://',
            icon: <LuLink className="size-4 text-neutral-gray4" />,
          }}
          errorMessage={urlError}
        />
        <TextField
          label={t('Title')}
          value={title}
          onChange={setTitleInput}
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

const normalizeHttpUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const hostnameFromUrl = (url: string | null): string => {
  if (!url) {
    return '';
  }
  try {
    return new URL(url).hostname.replace(/^www\./i, '').slice(0, 50);
  } catch {
    return '';
  }
};
