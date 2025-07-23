import { ReactNode } from 'react';

export const Chip = ({ children }: { children: ReactNode }) => {
  return (
    <span className="items-center rounded-sm bg-neutral-gray1 p-1 text-xs text-neutral-charcoal">
      {children}
    </span>
  );
};
