import { ReactNode } from 'react';

export const VotingSubmitFooter = ({
  isVisible,
  children,
}: {
  children?: ReactNode;
  isVisible: boolean;
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 z-50 flex h-14 w-full items-center justify-center border-t border-neutral-gray1 bg-white py-2">
      {children}
    </div>
  );
};
