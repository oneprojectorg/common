import Image from 'next/image';

// Same-origin URLs (e.g. `/assets/…` proxied to our storage) flow through
// Next's image optimizer; signed URLs to external hosts must set `unoptimized`
// because their domain isn't in `next.config.mjs > images.remotePatterns`.
// A protocol-relative URL (`//host/…`) also starts with `/` but is external,
// so we require a single leading slash.
const isSameOriginPath = (url: string) =>
  url.startsWith('/') && !url.startsWith('//');

export const AttachmentImage = ({
  mimeType,
  fileName,
  url,
}: {
  mimeType: string;
  fileName: string;
  url: string;
}) => {
  if (!mimeType.startsWith('image/') || !url) return null;

  return (
    <div className="relative flex h-fit w-full items-center justify-center rounded bg-neutral-gray1 text-white">
      <Image
        src={url}
        alt={fileName}
        fill
        unoptimized={!isSameOriginPath(url)}
        className="!relative size-full object-cover"
      />
    </div>
  );
};
