'use client';

import {
  PROCESS_NAME_MAX_LENGTH,
  PROCESS_NAME_MIN_LENGTH,
} from '@op/common/client';
import { EditableText } from '@op/sense/EditableText';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';

import { useTranslations } from '@/lib/i18n';

import { useSaveInstance } from './useSaveInstance';

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
  const updateInstance = useSaveInstance(slug);
  const shownName = updateInstance.isPending
    ? (updateInstance.variables.name ?? name)
    : name;

  const commit = (nextName: string) => {
    // The server has no minimum; Settings does, so the two paths must agree.
    if (nextName.length < PROCESS_NAME_MIN_LENGTH) {
      toast.error(t('processNameTooShort', { min: PROCESS_NAME_MIN_LENGTH }));
      return;
    }
    updateInstance.mutate({ instanceId, name: nextName });
  };

  return (
    <div className="flex w-full justify-center">
      <EditableText
        as="h1"
        dir="auto"
        wrap
        align="center"
        value={shownName}
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
