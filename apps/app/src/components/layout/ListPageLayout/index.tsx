import { cn } from '@op/sense/lib/utils';
import { ReactNode } from 'react';

/**
 * The main well's content column. Home, Updates, Decisions and Organizations
 * all share this width so moving between them in the sidebar doesn't make the
 * column jump (Figma 20924-74143 draws every one at the same width).
 */
export const ListPageLayout = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-12 sm:gap-8 sm:px-8 sm:pt-13',
        className,
      )}
    >
      {children}
    </div>
  );
};
