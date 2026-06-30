'use client';

import { DEFAULT_MAX_SIZE } from '@/hooks/useFileUpload';
import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { sanitizeTiptapDoc } from '@op/common/client';
import { BannerUploader } from '@op/ui/BannerUploader';
import { Button } from '@op/ui/Button';
import { RichTextEditor } from '@op/ui/RichTextEditor';
import { Skeleton } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';
import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { Suspense, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ErrorMessage } from '@/components/ErrorMessage';
import { RichTextEditorBubbleMenu } from '@/components/RichTextEditor';
import { getProposalExtensions } from '@/components/RichTextEditor/editorConfig';
import { useProcessBuilderAutosave } from '@/components/decisions/ProcessBuilder/ProcessBuilderAutosaveContext';
import { SaveStatusIndicator } from '@/components/decisions/ProcessBuilder/components/SaveStatusIndicator';
import type { SectionProps } from '@/components/decisions/ProcessBuilder/contentRegistry';
import { useProcessBuilderStore } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';

import { OverviewTextField } from './OverviewTextField';

// Must match the server-side caps in instanceOverviewInputEncoder
const HEADLINE_MAX_LENGTH = 50;
const DESCRIPTION_MAX_LENGTH = 500;

const ACCEPTED_IMAGE_TYPES = [
  'image/gif',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export default function OverviewSection(props: SectionProps) {
  return (
    <ErrorBoundary fallback={<ErrorMessage />}>
      <Suspense fallback={<OverviewSectionSkeleton />}>
        <OverviewSectionContent {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

// Public-facing overview page editor: headline and short description inputs
// above a divider, with a rich text body describing the process below it.
function OverviewSectionContent({
  decisionProfileId,
  instanceId,
}: SectionProps) {
  const t = useTranslations();

  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  const storeOverview = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId]?.overview,
  );
  const { saveChanges, autosaveStatus } = useProcessBuilderAutosave();

  // Prefer store (localStorage buffer) over API data — the store is written
  // synchronously on every save, so it's always the freshest source.
  // Captured once on mount; local state is the source of truth afterwards.
  const initialOverview = useRef({
    headline:
      storeOverview?.headline ??
      instance.instanceData?.overview?.headline ??
      '',
    description:
      storeOverview?.description ??
      instance.instanceData?.overview?.description ??
      '',
    body: storeOverview?.body ?? instance.instanceData?.overview?.body ?? '',
  }).current;

  const [headline, setHeadline] = useState(initialOverview.headline);
  const [description, setDescription] = useState(initialOverview.description);

  // Hero background image. Persisted via its own mutation (heavy bytes stay off
  // the text-autosave path); `bannerUrl` holds the display URL — an optimistic
  // data URL during upload, then the public URL of the stored path.
  const initialBackgroundImage =
    storeOverview?.backgroundImage ??
    instance.instanceData?.overview?.backgroundImage;
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(
    getPublicUrl(initialBackgroundImage),
  );
  const uploadBackgroundImage =
    trpc.decision.uploadOverviewBackgroundImage.useMutation();
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation();

  const handleBackgroundUpload = (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error({
        message: t('That file type is not supported. Accepted types: {types}', {
          types: ACCEPTED_IMAGE_TYPES.map((type) => type.split('/')[1]).join(
            ', ',
          ),
        }),
      });
      return;
    }
    if (file.size > DEFAULT_MAX_SIZE) {
      toast.error({
        message: t('File too large. Maximum size: {size}MB', {
          size: (DEFAULT_MAX_SIZE / 1024 / 1024).toFixed(2),
        }),
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string)?.split(',')[1];
      if (!base64) {
        return;
      }
      // Optimistic preview while the upload is in flight.
      setBannerUrl(`data:${file.type};base64,${base64}`);
      try {
        const res = await uploadBackgroundImage.mutateAsync({
          instanceId,
          file: base64,
          fileName: file.name,
          mimeType: file.type,
        });
        setBannerUrl(res.url);
      } catch {
        toast.error({ message: t('Something went wrong') });
        setBannerUrl(getPublicUrl(initialBackgroundImage));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundRemove = async () => {
    try {
      await updateInstance.mutateAsync({
        instanceId,
        overview: { backgroundImage: '' },
      });
      setBannerUrl(undefined);
    } catch {
      toast.error({ message: t('Something went wrong') });
    }
  };
  // The editor owns body state; track the latest JSON doc so headline/description
  // saves don't clobber it.
  const bodyRef = useRef<string | JSONContent>(initialOverview.body);

  // Editor instance, captured once ready, so the bubble menu can attach.
  const [editor, setEditor] = useState<Editor | null>(null);

  // Match the proposal editor's extension set so link embeds (paste a YouTube /
  // Vimeo / etc. URL → Iframely preview) work here too. Slash commands stay off:
  // the overview editor has no slash menu, only the bubble menu.
  const extensions = useMemo(
    () => getProposalExtensions({ slashCommands: false }),
    [],
  );

  const saveOverview = (patch: {
    headline?: string;
    description?: string;
    body?: string | JSONContent;
  }) => {
    saveChanges({
      overview: {
        headline,
        description,
        body: bodyRef.current,
        ...patch,
      },
    });
  };

  return (
    <div className="size-full [scrollbar-gutter:stable]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 md:px-0 md:py-6">
        <div className="flex justify-end">
          <SaveStatusIndicator
            status={autosaveStatus.status}
            savedAt={autosaveStatus.savedAt}
          />
        </div>

        <div className="flex flex-col gap-2">
          <BannerUploader
            label={t('Background image')}
            value={bannerUrl}
            onChange={handleBackgroundUpload}
            uploading={uploadBackgroundImage.isPending}
            error={uploadBackgroundImage.error?.message || undefined}
          />
          {bannerUrl ? (
            <Button
              color="secondary"
              className="w-auto self-end"
              isDisabled={updateInstance.isPending}
              onPress={handleBackgroundRemove}
            >
              {t('Remove image')}
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <OverviewTextField
            variant="headline"
            value={headline}
            maxLength={HEADLINE_MAX_LENGTH}
            placeholder={t('Add a headline')}
            onChange={(value) => {
              setHeadline(value);
              saveOverview({ headline: value });
            }}
          />
          <OverviewTextField
            variant="description"
            value={description}
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder={t(
              'Add a short description — one or two lines that sit under the headline.',
            )}
            onChange={(value) => {
              setDescription(value);
              saveOverview({ description: value });
            }}
          />
        </div>

        <hr className="border-neutral-gray1" />

        <RichTextEditor
          extensions={extensions}
          // Sanitize stored JSON so an unknown node type can't make TipTap blank
          // the whole doc on load (and autosave the blank). HTML strings parse
          // leniently, so only JSON needs it.
          content={
            typeof initialOverview.body === 'string'
              ? initialOverview.body
              : sanitizeTiptapDoc(initialOverview.body)
          }
          placeholder={t('overview_body_placeholder')}
          summaryPlaceholder={t('Write something...')}
          editorClassName="min-h-40"
          onChangeJSON={(json) => {
            // Persist the TipTap JSON doc so the overview renders via the
            // static React renderer. tiptap hands us the live editor's JSON, so
            // no stale-closure workaround is needed.
            bodyRef.current = json;
            saveOverview({ body: json });
          }}
          onEditorReady={setEditor}
        />

        <RichTextEditorBubbleMenu editor={editor} />
      </div>
    </div>
  );
}

function OverviewSectionSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 md:px-0 md:py-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-full" />
      </div>
      <hr className="border-neutral-gray1" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
