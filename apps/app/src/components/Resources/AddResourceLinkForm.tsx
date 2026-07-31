'use client';

import { trpc } from '@op/api/client';
import {
  RESOURCE_DESCRIPTION_MAX_LEN,
  RESOURCE_TITLE_MAX_LEN,
  httpUrlSchema,
} from '@op/common/client';
import { useDebounce } from '@op/hooks';
import { toast } from '@op/sense/Toast';
import { Button } from '@op/ui/Button';
import { TextField } from '@op/ui/TextField';
import { useState } from 'react';
import { LuLink } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { hostnameForDisplay, normalizeHttpUrl } from './utils';

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
  const createLink = trpc.resources.createLink.useMutation({
    onSuccess: () => toast.success(t('Resource added')),
    onError: () => toast.error(t('Could not add resource')),
  });

  const [url, setUrl] = useState('');
  const [titleInput, setTitleInput] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [urlError, setUrlError] = useState<string | undefined>();

  // Validation runs against the normalized form (see normalizeHttpUrl) so the
  // preview query and the API see the same URL.
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

  const previewTitle =
    previewQuery.data?.meta?.title?.slice(0, RESOURCE_TITLE_MAX_LEN) ?? '';
  const fallbackTitle = urlValid
    ? hostnameForDisplay(normalizedUrl, RESOURCE_TITLE_MAX_LEN)
    : '';
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
      { onSuccess },
    );
  };

  const submitting = createLink.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:px-6">
        <TextField
          label={t('URL')}
          value={url}
          onChange={(value) => {
            setUrl(value);
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
          maxLength={RESOURCE_TITLE_MAX_LEN}
          inputProps={{ placeholder: t('Add a title') }}
        />
        <TextField
          label={t('Description')}
          value={description}
          onChange={setDescription}
          maxLength={RESOURCE_DESCRIPTION_MAX_LEN}
          useTextArea
          textareaProps={{ placeholder: t('Add a description') }}
        />
      </div>
      <div className="sticky bottom-0 mt-auto flex shrink-0 gap-4 bg-white px-4 py-4 sm:px-6">
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
