import type { ReactNode } from 'react';

export const ToggleRow = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex items-center justify-between gap-4">{children}</div>
  );
};
