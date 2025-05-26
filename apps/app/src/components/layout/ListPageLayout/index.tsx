import { ReactNode } from 'react';

export const ListPageLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex w-full flex-col gap-5 px-4 pb-12 pt-8 sm:min-h-[calc(100vh-3.5rem)] sm:gap-6">
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
    <div className="flex flex-col gap-4 px-0">
      <div className="font-serif text-title-sm text-neutral-gray4 sm:text-title-lg">
        {children}
      </div>
    </div>
  );
};
