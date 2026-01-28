'use client';

import { useAwarenessUsers } from '@/hooks/useAwarenessUsers';
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
  const users = useAwarenessUsers(provider, { includeLocal: true });

  if (users.length === 0) {
    return null;
  }

  const visibleUsers = users.slice(0, maxVisible);
  const overflowCount = users.length - maxVisible;

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {visibleUsers.map((user) => (
        <div
          key={user.clientId}
          className="flex size-7 items-center justify-center rounded-full border-2 border-white text-xs font-medium text-white shadow"
          style={{ backgroundColor: user.color }}
          title={user.name}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
      ))}
      {overflowCount > 0 && (
        <div className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-neutral-charcoal text-xs text-white">
          +{overflowCount}
        </div>
      )}
    </div>
  );
}
