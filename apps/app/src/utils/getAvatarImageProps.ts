import { type ImageLoader, getImageProps } from 'next/image';

const ASSETS_PREFIX = '/assets/';

/**
 * `next/image` loader that serves an avatar as a square, center-cropped copy
 * from Supabase image transformations (the `/assets` rewrite in next.config.mjs
 * routes a `width` query to the render endpoint).
 * Uploads can have any aspect ratio, and the Next.js optimizer only resizes by
 * width, so a wide upload would come back too short to fill the circle.
 * Sources outside the assets bucket pass through unchanged.
 */
export const avatarImageLoader: ImageLoader = ({ src, width, quality }) => {
  if (!src.startsWith(ASSETS_PREFIX)) {
    return src;
  }

  const params = new URLSearchParams({
    width: String(width),
    height: String(width),
    resize: 'cover',
    quality: String(quality ?? 75),
  });

  return `${src}?${params}`;
};

// One width for every small avatar, so each avatar resolves to the same two
// crops (128px at 1x, 256px at 2x) wherever it renders and they are shared in
// cache. Sharp up to 128 CSS px, which covers every avatar size in the app, so
// callers never declare a size.
const AVATAR_IMAGE_WIDTH = 128;

/**
 * `src`/`srcSet` for an avatar `<img>` (sense `AvatarImage`/`ProfileAvatar`),
 * served as square crops instead of the raw upload. Returns an empty object
 * without a source, so callers can spread it.
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
    loader: avatarImageLoader,
  });

  return { src: props.src, srcSet: props.srcSet };
};
