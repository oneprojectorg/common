'use client';

import { useAwarenessUsers } from '@/hooks/useAwarenessUsers';
import { Avatar } from '@op/ui/Avatar';
import { FacePile } from '@op/ui/FacePile';
import type { TiptapCollabProvider } from '@tiptap-pro/provider';

interface CollaborativePresenceProps {
  provider: TiptapCollabProvider | null;
  /** Maximum avatars to show before "+N" overflow */
  maxVisible?: number;
  className?: string;
}

/**
 * Avatar stack showing users currently editing the document.
 * Subscribe to TipTap awareness to show real-time presence.
 */
export function CollaborativePresence({
  provider,
  maxVisible = 3,
  className,
}: CollaborativePresenceProps) {
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
