'use client';

import { useAwarenessUsers } from '@/hooks/useAwarenessUsers';
import { Avatar } from '@op/ui/Avatar';
import { cn } from '@op/ui/utils';
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

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {visibleUsers.map((user) => (
        <Avatar
          key={user.clientId}
          placeholder={user.name}
          size="sm"
          className="border-2 border-white"
        />
      ))}
      {overflowCount > 0 && (
        <Avatar
          placeholder={`+${overflowCount}`}
          size="sm"
          showFullText
          className="border-2 border-white bg-neutral-charcoal"
        />
      )}
    </div>
  );
}
