import { APP_NAME } from '@op/core';

export const CommonLogo = () => {
  return (
    <span className="rounded border border-orange2 p-1 font-mono text-xs text-orange2">
      {APP_NAME}
    </span>
  );
};
