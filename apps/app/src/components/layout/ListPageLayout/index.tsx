import { ReactNode } from 'react';

export const ListPageLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex w-full flex-col gap-3 pt-8 sm:min-h-[calc(100vh-3.5rem)] sm:gap-6">
      {children}
    </div>
  );
};

export const ListPageLayoutHeader = ({
  children,
}: {
  children?: ReactNode;
}) => {
  return (
    <div className="flex flex-col gap-4 px-4 sm:px-0">
      <div className="font-serif text-title-lg text-neutral-gray4">
        {children}
      </div>
    </div>
  );
};
