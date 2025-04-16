import type { ReactNode } from 'react';

export const ImageHeader = ({
  headerImage,
  avatarImage,
}: {
  headerImage?: ReactNode;
  avatarImage?: ReactNode;
}) => {
  return (
    <div className="relative w-full pb-14">
      <div className="relative aspect-[4.6] w-full bg-white">{headerImage}</div>
      <div className="absolute bottom-0 left-4 size-28 overflow-hidden rounded-full border-4 border-white bg-white shadow">
        {avatarImage}
      </div>
    </div>
  );
};
