import { ReactNode } from 'react';

export const ErrorMessage = ({ children }: { children?: ReactNode }) => {
  const message = 'Something went wrong';

  return <div>{children ?? message}</div>;
};
