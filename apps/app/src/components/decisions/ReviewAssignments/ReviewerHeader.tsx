import { Header1 } from '@op/sense/Header';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';

/** Server-rendered when the seeding fetch succeeded; else the client section renders it. */
export function ReviewerHeader({
  name,
  email,
}: {
  name: string;
  email: string | null;
}) {
  return (
    <div className="flex items-center gap-4">
      <ProfileAvatar name={name} alt={name} size="lg" />
      <div className="flex min-w-0 flex-col">
        <Header1 className="text-headline">{name}</Header1>
        {email ? (
          <span className="truncate text-sm text-muted-foreground">
            {email}
          </span>
        ) : null}
      </div>
    </div>
  );
}
