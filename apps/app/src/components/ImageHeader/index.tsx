import type { ReactNode } from 'react';

export const ImageHeader = ({ headerImage }: { headerImage?: ReactNode }) => {
  return (
    <div className="relative w-full pb-14">
      <div className="relative aspect-[4.6] w-full bg-white">{headerImage}</div>
      <div className="absolute bottom-0 left-4 size-28 rounded-full border-4 border-white bg-teal shadow" />
    </div>
  );
};
