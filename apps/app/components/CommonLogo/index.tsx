import { APP_NAME } from '@op/core';

export const CommonLogo = () => {
  return (
    <span className="rounded border border-orange2 p-[0.1875rem] font-mono text-[0.5rem] leading-[0.5rem] text-orange2 sm:p-1 sm:text-xs sm:leading-4">
      {APP_NAME}
    </span>
  );
};
