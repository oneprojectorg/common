import type { ReactNode } from 'react';

export const ToggleRow = ({ children }: { children: ReactNode }) => {
  return (
    <div className="gap-4 flex justify-between text-start">{children}</div>
  );
};
