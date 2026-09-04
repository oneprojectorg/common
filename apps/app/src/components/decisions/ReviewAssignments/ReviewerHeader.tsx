import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { ProfileItem } from '@op/sense/ProfileItem';

/** Server-rendered when the preload fetch succeeded; else the client section renders it. */
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
