import { ReactNode } from 'react';

export const Avatar = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="relative flex size-8 items-center justify-center overflow-hidden text-clip rounded-full border bg-white shadow">
      {children}
    </div>
  );
};
