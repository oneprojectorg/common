'use client';

import { IconContext } from 'react-icons';

export const IconProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <IconContext.Provider
      value={{ className: 'stroke-1 [&_*]:[vector-effect:non-scaling-stroke]' }}
    >
      {children}
    </IconContext.Provider>
  );
};
