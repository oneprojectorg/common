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
import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import he from 'he';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { LuPencil } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { RichTextEditorBubbleMenu } from '@/components/RichTextEditor';
import { getProposalExtensions } from '@/components/RichTextEditor/editorConfig';

import { AdminEmptyState } from './AdminEmptyState';

const DRAFT_SAVE_DELAY_MS = 1000;

interface ProcessAdminAboutProps {
  slug: string;
  instanceId: string;
  /** A draft has no reading view to protect: the editor is always up and writes through. */
  isDraft: boolean;
  /** The stored body, TipTap JSON or legacy HTML. */
  body: string | JSONContent | undefined;
  description: string | null | undefined;
  /** The About body, server-rendered by the page so it ships as HTML. */
  aboutSlot: ReactNode;
}

/**
 * The About section, edited where it sits. On a live process the page is the
 * page: Edit swaps the editor into the same box, Done or Save commits, Escape
 * or the cross discards, and clicking away asks only when something was typed.
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
  const utils = trpc.useUtils();
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
  const [draft, setDraft] = useState<JSONContent | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpen = draft !== null;
  const isEditing = isDraft || isOpen;

  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: async (_data, variables) => {
      if (typeof variables.overview?.body === 'object') {
        setSaved(variables.overview.body);
      }
      await utils.decision.getDecisionBySlug.invalidate({ slug });
    },
    onError: (error) => {
      logger.error('Process About save failed', { error });
      toast.error(t('saveError'));
    },
  });
  const save = (nextBody: JSONContent) =>
    updateInstance.mutate({ instanceId, overview: { body: nextBody } });

  const open = () => {
    setDraft(saved ?? (typeof storedContent === 'object' ? storedContent : {}));
    setIsDirty(false);
  };
  const discard = () => {
    setDraft(null);
    setIsDirty(false);
  };
  const commit = () => {
    if (draft !== null && isDirty) {
      save(draft);
    }
    discard();
  };

  // A draft writes through, a keystroke's pause later.
  const saveDraftBody = (nextBody: JSONContent) => {
    if (draftTimer.current) {
      clearTimeout(draftTimer.current);
    }
    draftTimer.current = setTimeout(() => save(nextBody), DRAFT_SAVE_DELAY_MS);
  };
  useEffect(
    () => () => {
      if (draftTimer.current) {
        clearTimeout(draftTimer.current);
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
        discard();
      }
    };
    node?.addEventListener('keydown', onKeyDown);
    return () => node?.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Clicking away ends the edit: silently when clean, after asking when dirty.
  useEffect(() => {
    if (!isOpen || isConfirming) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (
        !(event.target instanceof Node) ||
        box.current?.contains(event.target) ||
        outer.current?.contains(event.target) ||
        // The bubble menu portals out of the box but belongs to the edit.
        event.target.parentElement?.closest('[data-slot="bubble-menu"]')
      ) {
        return;
      }
      if (!isDirty) {
        discard();
        return;
      }
      event.preventDefault();
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

  return (
    <section ref={outer} className="flex min-w-0 flex-col gap-4 md:col-span-6">
      <div className="flex items-start justify-between gap-3">
        <Header2 className="text-label">{t('aboutHeading')}</Header2>
        {isDraft ? null : (
          <Button
            variant="link"
            size="inline"
            className="shrink-0 text-label"
            aria-label={
              isOpen ? t('finishEditingAboutLabel') : t('editAboutLabel')
            }
            onClick={isOpen ? commit : open}
          >
            <LuPencil className="size-3.5" aria-hidden />
            {isOpen ? tShared('Done') : tShared('Edit')}
          </Button>
        )}
      </div>
      <div
        ref={box}
        className={cn(
          '-mx-3 -my-2 rounded-lg px-3 py-2 transition-colors',
          isDraft
            ? 'focus-within:ring-1 focus-within:ring-input not-focus-within:hover:bg-muted/40'
            : isOpen
              ? 'ring-1 ring-input'
              : 'focus-within:bg-muted/40 hover:bg-muted/40',
        )}
      >
        {isEditing ? (
          <>
            <RichTextEditor
              extensions={extensions}
              content={isDraft ? storedContent : (draft ?? undefined)}
              placeholder={t('aboutPlaceholder')}
              editorClassName="min-h-40 focus-visible:ring-0"
              onChangeJSON={(json) => {
                if (isDraft) {
                  saveDraftBody(json);
                } else {
                  setDraft(json);
                  setIsDirty(true);
                }
              }}
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
                discard();
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
