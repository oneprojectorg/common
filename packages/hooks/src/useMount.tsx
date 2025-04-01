'use client';

import { useEffect, useState } from 'react';

const useMount = () => {
  const [mounted, setMounted] = useState<boolean>();

  useEffect(() => {
    setMounted(true);
  }, []);

  return {
    mounted,
  };
};

export default useMount;
