import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { ProfileItem } from '@op/sense/ProfileItem';

/** Rendered by the client section, from the same query as the assignment cards. */
export function ReviewerHeader({
  name,
  email,
}: {
  name: string;
  email: string | null;
}) {
  return (
    <ProfileItem
      avatar={<ProfileAvatar name={name} alt={name} size="lg" />}
      title={name}
      titleClassName="font-serif text-headline font-light"
      description={email ?? undefined}
    />
  );
}
