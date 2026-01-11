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
    <div className="border-neutral-gray1 fixed bottom-0 left-0 z-50 flex h-14 w-full items-center justify-center border-t bg-white py-2">
      {children}
    </div>
  );
};
