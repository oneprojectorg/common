'use client';

import { trpc } from '@op/api/client';
import { sanitizeTiptapDoc } from '@op/common/client';
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
import { type JSONContent, generateJSON } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import he from 'he';
import {
  type ReactNode,
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

import { AdminEmptyState } from './AdminEmptyState';

const DRAFT_SAVE_DELAY_MS = 1000;
const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

type DraftSaveStatus = 'idle' | 'saving' | 'saved';

interface ProcessAdminAboutProps {
  slug: string;
  instanceId: string;
  /** A draft has no reading view to protect: the editor is always up and writes through. */
  isDraft: boolean;
  /** The stored body, TipTap JSON or legacy HTML. */
  body?: string | JSONContent;
  description: string | null | undefined;
  /** The About body, server-rendered by the page so it ships as HTML. */
  aboutSlot: ReactNode;
}

/**
 * The About section, edited where it sits. On a live process Edit swaps the
 * editor into the same box, Done or Save commits, Escape discards, and
 * clicking away asks only when something was typed.
 */
export function ProcessAdminAbout({
  slug,
  instanceId,
  isDraft,
  body,
  description,
  aboutSlot,
}: ProcessAdminAboutProps) {
  const t = useTranslations('decisions.processAdmin');
  const tShared = useTranslations();
  const headingId = useId();
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
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<JSONContent | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftSaveStatus>('idle');
  const box = useRef<HTMLDivElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const baseline = useRef('');
  const isDirty = draft !== null && JSON.stringify(draft) !== baseline.current;

  const { sendSave, isSaving } = useOrderedBodySaves({
    slug,
    instanceId,
    onSaved: setSaved,
    onIdle: isDraft ? () => setDraftStatus('saved') : undefined,
  });

  const seed = saved ?? storedContent ?? '';

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

  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftBody = useRef<JSONContent | null>(null);
  const flushDraft = () => {
    draftTimer.current = null;
    const next = draftBody.current;
    draftBody.current = null;
    if (next) {
      sendSave(next);
    }
  };
  // A draft writes through, a keystroke's pause later.
  const saveDraftBody = (nextBody: JSONContent) => {
    draftBody.current = nextBody;
    setDraftStatus('saving');
    if (draftTimer.current) {
      clearTimeout(draftTimer.current);
    }
    draftTimer.current = setTimeout(flushDraft, DRAFT_SAVE_DELAY_MS);
  };
  const flushDraftRef = useRef(flushDraft);
  flushDraftRef.current = flushDraft;
  // Leaving the page within the pause still sends the last edit.
  useEffect(
    () => () => {
      if (draftTimer.current) {
        clearTimeout(draftTimer.current);
        flushDraftRef.current();
      }
    },
    [],
  );

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
  } else if (aboutSlot) {
    readView = aboutSlot;
  } else if (description) {
    readView = <p dir="auto">{he.decode(description)}</p>;
  } else {
    readView = (
      <AdminEmptyState
        title={t('noAboutTitle')}
        description={t('noAboutDescription')}
      />
    );
  }

  let boxClassName: string;
  if (isDraft) {
    boxClassName =
      'focus-within:ring-1 focus-within:ring-input not-focus-within:hover:bg-muted/40';
  } else if (isOpen) {
    boxClassName = 'ring-1 ring-input';
  } else {
    boxClassName = 'hover:bg-muted/40 focus-within:bg-muted/40';
  }

  const draftStatusLabels: Record<DraftSaveStatus, string> = {
    idle: '',
    saving: t('savingStatus'),
    saved: t('savedStatus'),
  };

  return (
    <section ref={outer} className="flex min-w-0 flex-col gap-4 md:col-span-6">
      <div className="flex items-start justify-between gap-3">
        <Header2 id={headingId} className="text-label">
          {t('aboutHeading')}
        </Header2>
        {isDraft ? (
          <span aria-live="polite" className="sr-only">
            {draftStatusLabels[draftStatus]}
          </span>
        ) : (
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
        )}
      </div>
      <div
        ref={box}
        className={cn(
          '-mx-3 -my-2 rounded-lg px-3 py-2 transition-colors',
          boxClassName,
        )}
      >
        {isDraft || isOpen ? (
          <>
            <RichTextEditor
              extensions={extensions}
              content={seed}
              placeholder={t('aboutPlaceholder')}
              ariaLabelledBy={headingId}
              editorClassName="min-h-40 focus-visible:ring-0"
              onChangeJSON={isDraft ? saveDraftBody : setDraft}
              onEditorReady={setEditor}
            />
            <RichTextEditorBubbleMenu
              editor={editor}
              allowCollapsible
              allowImages
            />
          </>
        ) : (
          readView
        )}
      </div>
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
    </section>
  );
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
  onIdle?: () => void;
}) {
  const t = useTranslations('decisions.processAdmin');
  const utils = trpc.useUtils();
  const inFlight = useRef(false);
  const waiting = useRef<JSONContent | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onError: (error) => {
      logger.error('Process About save failed', { error });
      toast.error(t('saveError'));
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
      {
        onSuccess: () => {
          onSaved(nextBody);
          onSuccess?.();
        },
        onSettled: () => {
          inFlight.current = false;
          const next = waiting.current;
          waiting.current = null;
          if (next) {
            sendSave(next);
            return;
          }
          setIsSaving(false);
          onIdle?.();
          void utils.decision.getDecisionBySlug.invalidate({ slug });
        },
      },
    );
  };

  return { sendSave, isSaving };
}
