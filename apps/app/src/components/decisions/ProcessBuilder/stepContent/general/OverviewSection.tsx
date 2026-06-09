'use client';

import { trpc } from '@op/api/client';
import { Skeleton } from '@op/ui/Skeleton';
import { Suspense, useEffect, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { RichTextEditorWithToolbar } from '@/components/RichTextEditor';
import { useProcessBuilderAutosave } from '@/components/decisions/ProcessBuilder/ProcessBuilderAutosaveContext';
import { SaveStatusIndicator } from '@/components/decisions/ProcessBuilder/components/SaveStatusIndicator';
import type { SectionProps } from '@/components/decisions/ProcessBuilder/contentRegistry';
import { useProcessBuilderStore } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';

// Wrapper component that waits for Zustand hydration before rendering the editor
export default function OverviewSection(props: SectionProps) {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const unsubscribe = useProcessBuilderStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    void useProcessBuilderStore.persist.rehydrate();

    return unsubscribe;
  }, []);

  if (!hasHydrated) {
    return <OverviewSectionSkeleton />;
  }

  return (
    <Suspense fallback={<OverviewSectionSkeleton />}>
      <OverviewSectionContent {...props} />
    </Suspense>
  );
}

// Public-facing overview page editor: headline, short description, and a
// rich text body describing the process for participants.
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
      storeOverview?.headline ?? instance.instanceData?.overview?.headline ?? '',
    description:
      storeOverview?.description ??
      instance.instanceData?.overview?.description ??
      '',
    body: storeOverview?.body ?? instance.instanceData?.overview?.body ?? '',
  }).current;

  const [headline, setHeadline] = useState(initialOverview.headline);
  const [description, setDescription] = useState(initialOverview.description);
  // The editor manages body state internally; track the latest HTML so
  // headline/description saves don't clobber it.
  const bodyRef = useRef(initialOverview.body);

  const saveOverview = (patch: {
    headline?: string;
    description?: string;
    body?: string;
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
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 md:px-0 md:py-6">
        <div className="flex justify-end">
          <SaveStatusIndicator
            status={autosaveStatus.status}
            savedAt={autosaveStatus.savedAt}
          />
        </div>

        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={headline}
            onChange={(e) => {
              setHeadline(e.target.value);
              saveOverview({ headline: e.target.value });
            }}
            placeholder={t('Add a headline')}
            aria-label={t('Add a headline')}
            className="w-full bg-transparent font-serif text-title-lg text-neutral-black placeholder:text-neutral-gray3 focus:outline-none"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              saveOverview({ description: e.target.value });
            }}
            placeholder={t(
              'Add a short description — one or two lines that sit under the headline.',
            )}
            aria-label={t(
              'Add a short description — one or two lines that sit under the headline.',
            )}
            className="w-full bg-transparent text-base text-neutral-black placeholder:text-neutral-gray3 focus:outline-none"
          />
        </div>

        <hr className="border-neutral-gray1" />

        <RichTextEditorWithToolbar
          content={initialOverview.body}
          placeholder={t(
            "Write what residents need to know about this process — its goals, timeline, who's running it, how to participate.",
          )}
          showToolbar={false}
          editorClassName="min-h-40"
          onChange={(html) => {
            bodyRef.current = html;
            saveOverview({ body: html });
          }}
        />
      </div>
    </div>
  );
}

// Skeleton shown while Zustand hydrates from localStorage
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
