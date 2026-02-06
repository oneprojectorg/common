'use client';

import { useAwarenessUsers } from '@/hooks/useAwarenessUsers';
import { Avatar } from '@op/ui/Avatar';
import { FacePile } from '@op/ui/FacePile';

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
  const { provider } = useCollaborativeDoc();
  const users = useAwarenessUsers(provider);

  if (users.length === 0) {
    return null;
  }

  const visibleUsers = users.slice(0, maxVisible);
  const overflowCount = users.length - maxVisible;

  const avatarItems = visibleUsers.map((user) => (
    <Avatar
      key={user.clientId}
      placeholder={user.name}
      size="sm"
      className="border-2 border-white"
    />
  ));

  if (overflowCount > 0) {
    avatarItems.push(
      <Avatar
        key="overflow"
        placeholder={`+${overflowCount}`}
        size="sm"
        className="border-2 border-white bg-neutral-charcoal"
      />,
    );
  }

  return <FacePile items={avatarItems} className={className} />;
}
