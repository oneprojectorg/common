'use client';

import { formatDate } from '@/utils/formatting';
import { Button } from '@op/sense/Button';
import { useState } from 'react';
import { LuRefreshCw } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ViewRevisionRequestModal } from './ViewRevisionRequestModal';

export function RevisedOnBadge({ respondedAt }: { respondedAt: string }) {
  const t = useTranslations();
  return (
    <span className="flex items-center gap-1">
      <LuRefreshCw className="size-4 text-primary-orange2" />
      {t('Revised on')} {formatDate(respondedAt)}
    </span>
  );
}

export function AuthorRevisionNote({
  comment,
  respondedAt,
}: {
  comment: string;
  /** Resubmission date — rendered in the note's own footer row. */
  respondedAt?: string | null;
}) {
  const t = useTranslations();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg bg-muted p-4">
        <span className="font-serif text-title-sm14 text-neutral-black">
          {t("Author's note")}
        </span>
        <div className="flex flex-col gap-2">
          <p
            dir="auto"
            className="text-base whitespace-pre-wrap text-neutral-charcoal"
          >
            {comment}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {respondedAt ? <RevisedOnBadge respondedAt={respondedAt} /> : null}
            <Button
              variant="link"
              size="inline"
              onClick={() => setIsModalOpen(true)}
              className="text-sm underline"
            >
              {t('View revision request')}
            </Button>
          </div>
        </div>
      </div>
      <ViewRevisionRequestModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}
