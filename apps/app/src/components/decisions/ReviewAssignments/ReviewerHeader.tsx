import type { AccountContact } from '@op/common/client';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { ProfileItem } from '@op/sense/ProfileItem';

import { accountContactText } from './accountContactText';

/** Rendered by the client section, from the same query as the assignment cards. */
export function ReviewerHeader({
  name,
  contact,
}: {
  name: string;
  contact: AccountContact | null;
}) {
  return (
    <ProfileItem
      avatar={
        // Sense stops at `lg` (40px); the design's header avatar is 64px.
        <ProfileAvatar
          name={name}
          alt={name}
          size="lg"
          className="data-[size=lg]:size-16 *:data-[slot=avatar-fallback]:text-title"
        />
      }
      title={name}
      titleClassName="font-serif text-headline font-light"
      description={accountContactText(contact) ?? undefined}
    />
  );
}
