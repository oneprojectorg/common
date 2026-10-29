'use client';

import { trpc } from '@op/api/client';
import {
  PROCESS_NAME_MAX_LENGTH,
  PROCESS_NAME_MIN_LENGTH,
} from '@op/common/client';
import { logger } from '@op/logging/client';
import { EditableText } from '@op/sense/EditableText';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

interface ProcessAdminTitleProps {
  slug: string;
  instanceId: string;
  name: string;
  /** Over a banner the title turns white, as the shared hero does. */
  hasImage: boolean;
}

/** The draft's title, edited in place: a pencil at rest, Enter commits, Escape or a blank value reverts. */
export function ProcessAdminTitle({
  slug,
  instanceId,
  name,
  hasImage,
}: ProcessAdminTitleProps) {
  const t = useTranslations('decisions.processAdmin');
  const tShared = useTranslations();
  const utils = trpc.useUtils();
  const [pendingName, setPendingName] = useState<string | null>(null);
  // Only the latest commit may clear the pending name, or an earlier save
  // settling would show its stale value while a later one is in flight.
  const commitCount = useRef(0);

  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: async () => {
      await utils.decision.getDecisionBySlug.invalidate({ slug });
    },
    onError: (error) => {
      logger.error('Process rename failed', { error });
      toast.error(t('saveError'));
    },
  });

  const commit = (nextName: string) => {
    // The server has no minimum; Settings does, so the two paths must agree.
    if (nextName.length < PROCESS_NAME_MIN_LENGTH) {
      toast.error(t('processNameTooShort', { min: PROCESS_NAME_MIN_LENGTH }));
      return;
    }
    commitCount.current += 1;
    const commitId = commitCount.current;
    setPendingName(nextName);
    updateInstance.mutate(
      { instanceId, name: nextName },
      {
        onSettled: () => {
          if (commitCount.current === commitId) {
            setPendingName(null);
          }
        },
      },
    );
  };

  return (
    <div className="flex w-full justify-center">
      <EditableText
        as="h1"
        dir="auto"
        wrap
        value={pendingName ?? name}
        label={t('processNameLabel')}
        editHint={t('editTitleHint')}
        doneLabel={tShared('Done')}
        maxLength={PROCESS_NAME_MAX_LENGTH}
        iconClassName="size-5"
        className={cn(
          'justify-center text-center font-serif text-display font-light',
          hasImage && 'text-white',
        )}
        onCommit={commit}
      />
    </div>
  );
}
