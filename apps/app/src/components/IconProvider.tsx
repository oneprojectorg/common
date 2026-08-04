'use client';

import { IconContext } from 'react-icons';

export const IconProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <IconContext.Provider
      value={{
        className: '[&_*]:[vector-effect:non-scaling-stroke]',
        style: { strokeWidth: 1.5 },
      }}
    >
      {children}
    </IconContext.Provider>
  );
};
