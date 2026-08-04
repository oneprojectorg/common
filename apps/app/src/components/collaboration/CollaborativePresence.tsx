'use client';

import { useAwarenessUsers } from '@/hooks/useAwarenessUsers';
import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { FacePile } from '@op/sense/FacePile';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

interface CollaborativePresenceProps {
  /** Maximum avatars to show before "+N" overflow */
  maxVisible?: number;
  className?: string;
}

/**
 * Avatar stack showing users currently editing the document.
 * Subscribes to TipTap awareness to show real-time presence.
 * Must be used within a CollaborativeDocProvider.
 */
export function CollaborativePresence({
  maxVisible = 3,
  className,
}: CollaborativePresenceProps) {
  const t = useTranslations();
  const { provider } = useCollaborativeDoc();
  const users = useAwarenessUsers(provider);

  if (users.length === 0) {
    return null;
  }

  const visibleUsers = users.slice(0, maxVisible);
  const overflowCount = users.length - maxVisible;

  // FacePile rings each face in the background color, so the faces need no
  // border of their own.
  const avatarItems = visibleUsers.map((user) => (
    <Avatar key={user.clientId} size="sm">
      <AvatarFallback name={user.name} />
    </Avatar>
  ));

  if (overflowCount > 0) {
    avatarItems.push(
      <Avatar key="overflow" size="sm">
        <AvatarFallback className="bg-foreground text-background">
          {t('+{count}', { count: overflowCount })}
        </AvatarFallback>
      </Avatar>,
    );
  }

  return (
    <FacePile
      items={avatarItems}
      className={className}
      role="group"
      aria-label={t('People currently editing')}
    />
  );
}
