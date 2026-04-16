'use client';

import { formatDate } from '@/utils/formatting';
import { Link } from '@op/ui/Link';
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

export function AuthorRevisionNote({ comment }: { comment: string }) {
  const t = useTranslations();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-gray1 bg-neutral-offWhite p-4">
        <span className="font-serif text-title-sm14 text-neutral-black">
          {t("Author's revision note")}
        </span>
        <div className="flex flex-col gap-2">
          <p className="text-base whitespace-pre-wrap text-neutral-charcoal">
            {comment}
          </p>
          <Link
            variant="secondary"
            onPress={() => setIsModalOpen(true)}
            className="self-start text-sm"
          >
            {t('View revision request')}
          </Link>
        </div>
      </div>
      <ViewRevisionRequestModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}
