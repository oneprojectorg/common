import type { ReactNode } from 'react';

import { Header1 } from '../Header';

export const FormHeader = ({
  text,
  children,
}: {
  text: string;
  children?: ReactNode;
}) => (
  <div className="flex flex-col gap-4 px-6">
    <Header1 className="text-center">{text}</Header1>

    <p className="text-center text-darkGray">{children}</p>
  </div>
);
