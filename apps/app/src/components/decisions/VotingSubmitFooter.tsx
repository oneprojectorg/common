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
    <div className="bottom-0 left-0 h-14 py-2 fixed z-50 flex w-full items-center justify-center border-t bg-white">
      {children}
    </div>
  );
};
