'use client';

import { trpc } from '@op/api/client';
import { StyledRichTextContent, baseEditorStyles } from '@op/ui/RichTextEditor';
import { Skeleton } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import Placeholder from '@tiptap/extension-placeholder';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ErrorMessage } from '@/components/ErrorMessage';
import { RichTextEditorBubbleMenu } from '@/components/RichTextEditor';
import { useProcessBuilderAutosave } from '@/components/decisions/ProcessBuilder/ProcessBuilderAutosaveContext';
import { SaveStatusIndicator } from '@/components/decisions/ProcessBuilder/components/SaveStatusIndicator';
import type { SectionProps } from '@/components/decisions/ProcessBuilder/contentRegistry';
import { useProcessBuilderStore } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';

/**
 * TipTap JSON document holding the overview body. Headline and description
 * are plain strings (separate inputs), so other surfaces can render them
 * without parsing a TipTap document — only the body needs a rich viewer.
 */
interface OverviewBodyDoc {
  type: 'doc';
  content?: Record<string, unknown>[];
}

// Must match the server-side caps in instanceOverviewEncoder
const HEADLINE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 500;

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
    content: storeOverview?.content ?? instance.instanceData?.overview?.content,
  }).current;

  const [headline, setHeadline] = useState(initialOverview.headline);
  const [description, setDescription] = useState(initialOverview.description);
  // The editor manages body state internally; track the latest doc so
  // headline/description saves don't clobber it.
  const bodyRef = useRef<OverviewBodyDoc | undefined>(initialOverview.content);

  // Set when stored content fails to load into the editor. The body editor
  // is replaced with an error message and body saves are suppressed so a
  // broken load can never round-trip into a destructive overwrite.
  const [contentError, setContentError] = useState(false);
  const contentErrorRef = useRef(false);

  const saveOverview = (patch: {
    headline?: string;
    description?: string;
    content?: OverviewBodyDoc;
  }) => {
    saveChanges({
      overview: {
        headline,
        description,
        content: bodyRef.current,
        ...patch,
      },
    });
  };

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        link: { openOnClick: false },
      }),
      Placeholder.configure({
        placeholder: t(
          "Write what residents need to know about this process — its goals, timeline, who's running it, how to participate.",
        ),
      }),
    ],
    [t],
  );

  // Only a missing or empty body starts fresh. Any other shape — including
  // malformed stored data — is passed to the editor, where enableContentCheck
  // routes it to onContentError instead of silently treating it as new.
  const bodyNodes: unknown = initialOverview.content?.content;
  const isFreshBody =
    bodyNodes === undefined ||
    (Array.isArray(bodyNodes) && bodyNodes.length === 0);
  const initialBody = isFreshBody ? null : initialOverview.content;

  const editor = useEditor({
    extensions,
    content: initialBody,
    immediatelyRender: false,
    enableContentCheck: true,
    onContentError: ({ error }) => {
      contentErrorRef.current = true;
      console.error('Failed to load overview content', { instanceId, error });
      setContentError(true);
    },
    editorProps: {
      attributes: {
        class: cn(
          baseEditorStyles,
          'min-h-40',
          // Placeholder decoration (Placeholder extension)
          '[&_.is-empty]:before:pointer-events-none [&_.is-empty]:before:float-start [&_.is-empty]:before:h-0 [&_.is-empty]:before:text-neutral-gray3 [&_.is-empty]:before:content-[attr(data-placeholder)]',
        ),
      },
    },
    onUpdate: ({ editor }) => {
      if (contentErrorRef.current) {
        return;
      }
      const body: OverviewBodyDoc = editor.state.doc.toJSON();
      bodyRef.current = body;
      saveOverview({ content: body });
    },
  });

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
          <input
            type="text"
            value={headline}
            maxLength={HEADLINE_MAX_LENGTH}
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
            maxLength={DESCRIPTION_MAX_LENGTH}
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

        {contentError ? (
          <ErrorMessage />
        ) : editor ? (
          <StyledRichTextContent editor={editor} />
        ) : (
          <OverviewBodySkeleton />
        )}

        <RichTextEditorBubbleMenu editor={contentError ? null : editor} />
      </div>
    </div>
  );
}

function OverviewBodySkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
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
      <OverviewBodySkeleton />
    </div>
  );
}
