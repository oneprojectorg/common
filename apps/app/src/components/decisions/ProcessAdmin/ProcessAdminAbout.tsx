'use client';

import { trpc } from '@op/api/client';
import { sanitizeTiptapDoc } from '@op/common/client';
import { useDebouncedCallback } from '@op/hooks';
import { logger } from '@op/logging/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@op/sense/AlertDialog';
import { Button } from '@op/sense/Button';
import { Header2 } from '@op/sense/Header';
import { RichTextEditor, RichTextViewer } from '@op/sense/RichTextEditor';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { type Extensions, type JSONContent, generateJSON } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import {
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LuPencil } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { RichTextEditorBubbleMenu } from '@/components/RichTextEditor';
import { getProposalExtensions } from '@/components/RichTextEditor/editorConfig';

import { OverviewAbout } from '../DecisionOverview';
import { AdminEmptyState } from './AdminEmptyState';

const DRAFT_SAVE_DELAY_MS = 1000;
const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

type DraftSaveStatus = 'idle' | 'saving' | 'saved';
type AboutBody = string | JSONContent;

interface ProcessAdminAboutProps {
  slug: string;
  instanceId: string;
  /** A draft has no reading view to protect: the editor is always up and writes through. */
  isDraft: boolean;
  /** The stored body, TipTap JSON or legacy HTML. */
  body?: AboutBody;
  description: string | null | undefined;
  /** The About body, server-rendered by the page so it ships as HTML. */
  aboutSlot: ReactNode;
}

/** The About section, edited where it sits. */
export function ProcessAdminAbout({
  slug,
  instanceId,
  isDraft,
  body,
  description,
  aboutSlot,
}: ProcessAdminAboutProps) {
  if (isDraft) {
    return <DraftAbout slug={slug} instanceId={instanceId} body={body} />;
  }
  return (
    <LiveAbout
      slug={slug}
      instanceId={instanceId}
      body={body}
      description={description}
      aboutSlot={aboutSlot}
    />
  );
}

/** The editor is always up and writes through, a keystroke's pause later. */
function DraftAbout({
  slug,
  instanceId,
  body,
}: {
  slug: string;
  instanceId: string;
  body?: AboutBody;
}) {
  const t = useTranslations('decisions.processAdmin');
  const headingId = useId();
  const { extensions, seed, setSaved } = useAboutBody(body);
  const [status, setStatus] = useState<DraftSaveStatus>('idle');

  const { sendSave } = useOrderedBodySaves({
    slug,
    instanceId,
    onSaved: setSaved,
    onIdle: (ok) => setStatus(ok ? 'saved' : 'idle'),
  });
  const saveAfterPause = useDebouncedCallback(
    (nextBody: JSONContent) => sendSave(nextBody),
    DRAFT_SAVE_DELAY_MS,
  );
  // Leaving the page within the pause still sends the last edit.
  useEffect(() => () => void saveAfterPause.flush(), [saveAfterPause]);

  const statusLabels: Record<DraftSaveStatus, string> = {
    idle: '',
    saving: t('savingStatus'),
    saved: t('savedStatus'),
  };

  return (
    <AboutFrame
      headingId={headingId}
      action={
        <span aria-live="polite" className="sr-only">
          {statusLabels[status]}
        </span>
      }
      boxClassName="focus-within:ring-1 focus-within:ring-input not-focus-within:hover:bg-muted/40"
    >
      <AboutEditor
        extensions={extensions}
        content={seed}
        headingId={headingId}
        onChangeJSON={(nextBody) => {
          setStatus('saving');
          saveAfterPause(nextBody);
        }}
      />
    </AboutFrame>
  );
}

/**
 * Edit swaps the editor into the reading box, Done or Save commits, Escape
 * discards, and clicking away asks only when something was typed.
 */
function LiveAbout({
  slug,
  instanceId,
  body,
  description,
  aboutSlot,
}: {
  slug: string;
  instanceId: string;
  body?: AboutBody;
  description: string | null | undefined;
  aboutSlot: ReactNode;
}) {
  const t = useTranslations('decisions.processAdmin');
  const tShared = useTranslations();
  const headingId = useId();
  const { extensions, seed, saved, setSaved } = useAboutBody(body);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<JSONContent | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const outer = useRef<HTMLElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const baseline = useRef('');
  const isDirty = draft !== null && JSON.stringify(draft) !== baseline.current;

  const { sendSave, isSaving } = useOrderedBodySaves({
    slug,
    instanceId,
    onSaved: setSaved,
  });

  const close = () => {
    setIsOpen(false);
    setDraft(null);
    editButton.current?.focus();
  };
  const open = () => {
    baseline.current = JSON.stringify(
      typeof seed === 'string'
        ? seed
          ? generateJSON(seed, extensions)
          : EMPTY_DOC
        : seed,
    );
    setDraft(null);
    setIsOpen(true);
  };
  // The editor stays up until the save lands, so a failed save keeps the text.
  const commit = () => {
    if (!isDirty || draft === null) {
      close();
      return;
    }
    sendSave(draft, close);
  };

  // Escape discards. Focus leaving the box does not: the editor holds a
  // toolbar, and taking one of its buttons is not leaving.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const node = box.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    node?.addEventListener('keydown', onKeyDown);
    return () => node?.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Clicking away ends the edit: silently when clean, after asking when dirty.
  // A dirty press is a question, so the click it would become is swallowed.
  useEffect(() => {
    if (!isOpen || isConfirming) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        box.current?.contains(target) ||
        outer.current?.contains(target) ||
        // The link and embed forms portal out of the box but belong to the edit.
        target.closest('[data-slot="popover-content"]')
      ) {
        return;
      }
      if (!isDirty) {
        close();
        return;
      }
      event.preventDefault();
      document.addEventListener(
        'click',
        (click) => {
          click.preventDefault();
          click.stopPropagation();
        },
        { capture: true, once: true },
      );
      setIsConfirming(true);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () =>
      document.removeEventListener('pointerdown', onPointerDown, true);
  }, [isOpen, isConfirming, isDirty]);

  let readView: ReactNode;
  if (saved) {
    readView = <RichTextViewer content={saved} />;
  } else if (aboutSlot || description) {
    readView = (
      <OverviewAbout
        bodySlot={aboutSlot}
        fallbackText={description ?? undefined}
      />
    );
  } else {
    readView = (
      <AdminEmptyState
        title={t('noAboutTitle')}
        description={t('noAboutDescription')}
      />
    );
  }

  return (
    <>
      <AboutFrame
        headingId={headingId}
        outerRef={outer}
        boxRef={box}
        action={
          <Button
            ref={editButton}
            variant="link"
            size="inline"
            className="shrink-0 text-label"
            aria-describedby={headingId}
            disabled={isSaving}
            onClick={isOpen ? commit : open}
          >
            {isOpen ? null : <LuPencil className="size-3.5" aria-hidden />}
            {isOpen ? tShared('Done') : tShared('Edit')}
          </Button>
        }
        boxClassName={
          isOpen
            ? 'ring-1 ring-input'
            : 'hover:bg-muted/40 focus-within:bg-muted/40'
        }
      >
        {isOpen ? (
          <AboutEditor
            extensions={extensions}
            content={seed}
            headingId={headingId}
            onChangeJSON={setDraft}
          />
        ) : (
          readView
        )}
      </AboutFrame>
      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('keepChangesTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('keepChangesDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setIsConfirming(false);
                close();
              }}
            >
              {t('discardAction')}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setIsConfirming(false);
                commit();
              }}
            >
              {tShared('Save changes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AboutFrame({
  headingId,
  action,
  boxClassName,
  outerRef,
  boxRef,
  children,
}: {
  headingId: string;
  action: ReactNode;
  boxClassName: string;
  outerRef?: Ref<HTMLElement>;
  boxRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const t = useTranslations('decisions.processAdmin');

  return (
    <section
      ref={outerRef}
      className="flex min-w-0 flex-col gap-3 md:w-80 md:shrink-0 lg:w-140"
    >
      <div className="flex items-start justify-between gap-3">
        <Header2 id={headingId} className="text-label">
          {t('aboutHeading')}
        </Header2>
        {action}
      </div>
      <div
        ref={boxRef}
        className={cn(
          '-mx-3 -my-2 rounded-lg px-3 py-2 transition-colors',
          boxClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

function AboutEditor({
  extensions,
  content,
  headingId,
  onChangeJSON,
}: {
  extensions: Extensions;
  content: AboutBody;
  headingId: string;
  onChangeJSON: (body: JSONContent) => void;
}) {
  const t = useTranslations('decisions.processAdmin');
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    <>
      <RichTextEditor
        extensions={extensions}
        content={content}
        placeholder={t('aboutPlaceholder')}
        ariaLabelledBy={headingId}
        editorClassName="min-h-40 focus-visible:ring-0"
        onChangeJSON={onChangeJSON}
        onEditorReady={setEditor}
      />
      <RichTextEditorBubbleMenu editor={editor} allowCollapsible allowImages />
    </>
  );
}

function useAboutBody(body: AboutBody | undefined) {
  const extensions = useMemo(
    () => getProposalExtensions({ slashCommands: false }),
    [],
  );
  // Sanitized so an unknown node cannot make TipTap blank the doc on load.
  const storedContent = useMemo(
    () =>
      typeof body === 'string' || body === undefined
        ? body
        : sanitizeTiptapDoc(body),
    [body],
  );
  // What this client last saved; the server-rendered slot is stale after a save.
  const [saved, setSaved] = useState<JSONContent | null>(null);

  return { extensions, saved, setSaved, seed: saved ?? storedContent ?? '' };
}

/**
 * Saves to one row go out in order: one in flight, the latest waiting behind
 * it, and the query is invalidated once the last one settles.
 */
function useOrderedBodySaves({
  slug,
  instanceId,
  onSaved,
  onIdle,
}: {
  slug: string;
  instanceId: string;
  onSaved: (body: JSONContent) => void;
  /** Fires once the queue drains; `ok` is false when the last save failed. */
  onIdle?: (ok: boolean) => void;
}) {
  const t = useTranslations('decisions.processAdmin');
  const utils = trpc.useUtils();
  const inFlight = useRef(false);
  const waiting = useRef<JSONContent | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // The queue drains and the query refreshes from the hook-level callbacks,
  // which still run after this component unmounts; per-call ones do not.
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: (_data, variables) => {
      const savedBody = variables.overview?.body;
      if (typeof savedBody === 'object') {
        onSaved(savedBody);
      }
    },
    onError: (error) => {
      logger.error('Process About save failed', { error });
      toast.error(t('saveError'));
    },
    onSettled: (_data, error) => {
      inFlight.current = false;
      const next = waiting.current;
      waiting.current = null;
      if (next) {
        sendSave(next);
        return;
      }
      setIsSaving(false);
      onIdle?.(error === null);
      void utils.decision.getDecisionBySlug.invalidate({ slug });
    },
  });

  const sendSave = (nextBody: JSONContent, onSuccess?: () => void) => {
    if (inFlight.current) {
      waiting.current = nextBody;
      return;
    }
    inFlight.current = true;
    setIsSaving(true);
    updateInstance.mutate(
      { instanceId, overview: { body: nextBody } },
      { onSuccess },
    );
  };

  return { sendSave, isSaving };
}
