'use client';

import { useRelativeTime } from '@op/hooks';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@op/sense/Accordion';
import { Button } from '@op/sense/Button';
import { Header3 } from '@op/sense/Header';
import { Separator } from '@op/sense/Separator';
import { Fragment, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

/** One resubmission: the author's note plus the requests it answered. */
export interface AuthorNote {
  /** Stable key — the resubmitted proposal version, or the note's own request. */
  id: string;
  comment: string;
  respondedAt: string;
  /** Requests this resubmission answered, newest first. */
  requestIds: string[];
}

const NOTES_ITEM = 'author-notes';

/**
 * The author's resubmission notes, newest first. Presentational: the caller
 * owns the read and what "view requests" opens, so the admin summary can reuse
 * it against the same grouped notes.
 */
export function AuthorNotesAccordion({
  notes,
  onViewRequests,
}: {
  notes: Array<AuthorNote>;
  onViewRequests: (requestIds: Array<string>) => void;
}) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(true);

  if (notes.length === 0) {
    return null;
  }

  const entries = (
    <div className="flex flex-col gap-6">
      {notes.map((note, index) => (
        <Fragment key={note.id}>
          {index > 0 ? <Separator /> : null}
          <AuthorNoteEntry note={note} onViewRequests={onViewRequests} />
        </Fragment>
      ))}
    </div>
  );

  // A single note has nothing to collapse into, so it skips the accordion
  // chrome and renders as a plain card.
  if (notes.length === 1) {
    return (
      <section
        data-testid="author-notes"
        className="flex flex-col gap-4 rounded-lg border border-border bg-muted p-4"
      >
        <Header3>{t('Author notes')}</Header3>
        {entries}
      </section>
    );
  }

  return (
    <Accordion
      data-testid="author-notes"
      value={isOpen ? [NOTES_ITEM] : []}
      onValueChange={(value) => setIsOpen(value.length > 0)}
      className="rounded-lg border border-border bg-muted px-4"
    >
      <AccordionItem value={NOTES_ITEM}>
        <AccordionTrigger
          aria-label={
            isOpen ? t('Collapse author notes') : t('Expand author notes')
          }
        >
          {t('Author notes')}
        </AccordionTrigger>
        <AccordionContent>{entries}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function AuthorNoteEntry({
  note,
  onViewRequests,
}: {
  note: AuthorNote;
  onViewRequests: (requestIds: Array<string>) => void;
}) {
  const t = useTranslations();
  const timeAgo = useRelativeTime(note.respondedAt, { style: 'long' });

  return (
    <div data-testid="author-note" className="flex flex-col gap-3">
      <p dir="auto" className="text-base whitespace-pre-wrap">
        {note.comment}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{t('Revised {timeAgo}', { timeAgo })}</span>
        {note.requestIds.length > 0 ? (
          <Button
            variant="link"
            size="inline"
            className="text-sm underline"
            onClick={() => onViewRequests(note.requestIds)}
          >
            {note.requestIds.length === 1
              ? t('View revision request')
              : t('View revision requests')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
