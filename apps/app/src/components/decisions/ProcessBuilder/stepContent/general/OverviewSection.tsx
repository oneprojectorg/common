'use client';

import { trpc } from '@op/api/client';
import { StyledRichTextContent, baseEditorStyles } from '@op/ui/RichTextEditor';
import { Skeleton } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import { useEditor } from '@tiptap/react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  RichTextEditorFloatingToolbar,
  useRichTextEditorFloatingToolbar,
} from '@/components/RichTextEditor';
import { useProcessBuilderAutosave } from '@/components/decisions/ProcessBuilder/ProcessBuilderAutosaveContext';
import { SaveStatusIndicator } from '@/components/decisions/ProcessBuilder/components/SaveStatusIndicator';
import type { SectionProps } from '@/components/decisions/ProcessBuilder/contentRegistry';
import { useProcessBuilderStore } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';

import {
  buildOverviewDoc,
  extractOverviewParts,
  getOverviewEditorExtensions,
  isSelectionInBody,
} from './overviewEditor';

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

// Public-facing overview page editor: a single TipTap editor with a fixed
// structure — headline, short description, an immovable divider, and a rich
// text body describing the process for participants.
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
  // Captured once on mount; the editor is the source of truth afterwards.
  const initialDoc = useRef(
    buildOverviewDoc({
      headline:
        storeOverview?.headline ??
        instance.instanceData?.overview?.headline ??
        '',
      description:
        storeOverview?.description ??
        instance.instanceData?.overview?.description ??
        '',
      content:
        storeOverview?.content ?? instance.instanceData?.overview?.content,
    }),
  ).current;

  const extensions = useMemo(() => getOverviewEditorExtensions(t), [t]);

  const editor = useEditor({
    extensions,
    content: initialDoc,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          baseEditorStyles,
          'min-h-40',
          // Subhead spacing + the fixed divider styling
          '[&_p[data-overview-subhead]]:mt-2 [&_p[data-overview-subhead]]:mb-6',
          '[&_hr]:border-neutral-gray1',
          // Per-node placeholder decorations (Placeholder extension)
          '[&_.is-empty]:before:pointer-events-none [&_.is-empty]:before:float-start [&_.is-empty]:before:h-0 [&_.is-empty]:before:text-neutral-gray3 [&_.is-empty]:before:content-[attr(data-placeholder)]',
        ),
      },
    },
    onUpdate: ({ editor: e }) => {
      saveChanges({ overview: extractOverviewParts(e.state.doc) });
    },
  });

  const { isVisible, position, handleSelectionChange } =
    useRichTextEditorFloatingToolbar({ editor });

  // Only surface the toolbar in the body — the title/subhead schema blocks
  // marks and block changes, so its actions would be dead there
  const showToolbar = isVisible && editor !== null && isSelectionInBody(editor);

  return (
    <div className="size-full [scrollbar-gutter:stable]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 md:px-0 md:py-6">
        <div className="flex justify-end">
          <SaveStatusIndicator
            status={autosaveStatus.status}
            savedAt={autosaveStatus.savedAt}
          />
        </div>

        {editor ? (
          <StyledRichTextContent editor={editor} />
        ) : (
          <OverviewEditorSkeleton />
        )}

        <RichTextEditorFloatingToolbar
          editor={editor}
          isVisible={showToolbar}
          position={position}
          onSelectionChange={handleSelectionChange}
        />
      </div>
    </div>
  );
}

function OverviewEditorSkeleton() {
  return (
    <div className="flex flex-col gap-6">
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

// Skeleton shown while Zustand hydrates from localStorage
function OverviewSectionSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 md:px-0 md:py-6">
      <OverviewEditorSkeleton />
    </div>
  );
}
