import type { ReactNode } from 'react';

export const FormContainer = ({ children }: { children: ReactNode }) => {
  return <div className="flex flex-col gap-8 pb-8">{children}</div>;
};
