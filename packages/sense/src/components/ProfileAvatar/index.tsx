import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface ProfileAvatarProps {
  /** Display name — seeds the fallback initials + gradient when no image. */
  name?: string | null;
  /** Resolved image URL. Callers resolve storage paths (e.g. getPublicUrl). */
  src?: string | null;
  alt: string;
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

/** Avatar with an image when available, initials/gradient fallback otherwise. */
function ProfileAvatar({
  name,
  src,
  alt,
  size,
  className,
}: ProfileAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt={alt} /> : null}
      <AvatarFallback name={name ?? undefined} />
    </Avatar>
  );
}

export { ProfileAvatar };
