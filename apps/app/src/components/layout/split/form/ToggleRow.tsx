import type { ReactNode } from 'react';

export const ToggleRow = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex justify-between gap-4 text-start">{children}</div>
  );
};
