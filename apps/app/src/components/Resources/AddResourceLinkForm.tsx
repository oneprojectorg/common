'use client';

import { trpc } from '@op/api/client';
import {
  RESOURCE_DESCRIPTION_MAX_LEN,
  RESOURCE_TITLE_MAX_LEN,
  httpUrlSchema,
} from '@op/common/client';
import { useDebounce } from '@op/hooks';
import { Button } from '@op/sense/Button';
import { Field, FieldError, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@op/sense/InputGroup';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import { Textarea } from '@op/sense/Textarea';
import { toast } from '@op/sense/Toast';
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
        <Field data-invalid={urlError ? true : undefined}>
          <FieldLabel htmlFor="resource-url">
            {t('URL')}
            <RequiredAsterisk />
          </FieldLabel>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <LuLink className="size-4 text-neutral-gray4" />
            </InputGroupAddon>
            <InputGroupInput
              id="resource-url"
              type="text"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://"
              required
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                if (urlError) {
                  setUrlError(undefined);
                }
              }}
              aria-invalid={urlError ? true : undefined}
              className="[unicode-bidi:plaintext]"
            />
          </InputGroup>
          {urlError ? <FieldError>{urlError}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="resource-title">
            {t('Title')}
            <RequiredAsterisk />
          </FieldLabel>
          <Input
            id="resource-title"
            value={title}
            onChange={(event) => setTitleInput(event.target.value)}
            required
            maxLength={RESOURCE_TITLE_MAX_LEN}
            placeholder={t('Add a title')}
            className="[unicode-bidi:plaintext]"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="resource-description">
            {t('Description')}
          </FieldLabel>
          <Textarea
            id="resource-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={RESOURCE_DESCRIPTION_MAX_LEN}
            placeholder={t('Add a description')}
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
          disabled={!urlValid || !title.trim() || submitting}
          className="flex-1 justify-center"
        >
          {submitting ? t('Adding...') : t('Add resource')}
        </Button>
      </div>
    </form>
  );
};
