import { ReactNode, useMemo } from 'react';

import { cn } from '../../lib/utils';
import { getGradientForString } from '../../utils';

export const Avatar = ({
  children,
  placeholder,
  className,
}: {
  children?: ReactNode;
  placeholder?: string;
  className?: string;
}) => {
  const gradientBg = useMemo(
    () => getGradientForString(placeholder || 'Common'),
    [],
  );

  console.log('gradientBg', gradientBg);
  return (
    <div
      className={cn(
        'relative flex size-8 items-center justify-center overflow-hidden text-clip rounded-full bg-white shadow outline outline-neutral-gray1',
        className,
      )}
    >
      {children === null ? (
        <div
          className={cn(
            'bg-yellowOrange flex size-full items-center justify-center text-white',
            gradientBg,
          )}
        >
          {placeholder?.slice(0, 1) ?? ''}
        </div>
      ) : (
        children
      )}
    </div>
  );
};
