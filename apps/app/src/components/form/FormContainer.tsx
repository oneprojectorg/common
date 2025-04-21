import { ReactNode } from 'react';

export const FormContainer = ({ children }: { children: ReactNode }) => {
  return <div className="flex flex-col gap-4">{children}</div>;
};
