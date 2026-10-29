'use client';

import { trpc } from '@op/api/client';
import { PROCESS_NAME_MAX_LENGTH } from '@op/common/client';
import { EditableText } from '@op/sense/EditableText';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useState } from 'react';

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

  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: async () => {
      await utils.decision.getDecisionBySlug.invalidate({ slug });
    },
    onError: (error) => {
      toast.error(t('saveError'), { description: error.message });
    },
    onSettled: () => setPendingName(null),
  });

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
        onCommit={(nextName) => {
          setPendingName(nextName);
          updateInstance.mutate({ instanceId, name: nextName });
        }}
      />
    </div>
  );
}
