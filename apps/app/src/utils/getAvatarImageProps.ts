import { getImageProps } from 'next/image';

// One width for every avatar, so each avatar resolves to the same two
// optimizer URLs (128w at 1x, 256w at 2x) wherever it renders and the resized
// copies are shared in cache. Sharp up to 128 CSS px, which covers every
// avatar size in the app, so callers never declare a size.
const AVATAR_IMAGE_WIDTH = 128;

/**
 * `src`/`srcSet` for an avatar `<img>` (sense `AvatarImage`/`ProfileAvatar`),
 * served through the Next.js image optimizer instead of the raw upload.
 * Returns an empty object without a source, so callers can spread it.
 */
export const getAvatarImageProps = (
  src?: string | null,
): { src?: string; srcSet?: string } => {
  if (!src) {
    return {};
  }

  const { props } = getImageProps({
    src,
    alt: '',
    width: AVATAR_IMAGE_WIDTH,
    height: AVATAR_IMAGE_WIDTH,
  });

  return { src: props.src, srcSet: props.srcSet };
};
