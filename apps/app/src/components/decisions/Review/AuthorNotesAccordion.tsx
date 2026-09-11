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

export interface AuthorNote {
  /** The resubmitted proposal version. */
  id: string;
  comment: string;
  respondedAt: string;
  requestIds: string[];
}

const NOTES_ITEM = 'author-notes';

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

  // One note has nothing to collapse into.
  if (notes.length === 1) {
    return (
      <section
        data-testid="author-notes"
        className="flex flex-col gap-4 rounded-lg border border-border bg-muted p-6"
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
      className="rounded-lg border border-border bg-muted p-6"
    >
      <AccordionItem value={NOTES_ITEM}>
        {/* The card is the frame, so the trigger drops its own border. */}
        <AccordionTrigger className="items-center py-0 hover:no-underline focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ring">
          {t('Author notes')}
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-0">{entries}</AccordionContent>
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
