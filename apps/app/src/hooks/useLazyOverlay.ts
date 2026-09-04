'use client';

import { useCallback, useState } from 'react';

/**
 * Open state for a dialog/sheet whose component is loaded with `next/dynamic`.
 *
 * `shouldRender` is a mount latch: it flips on at the first open and never goes
 * back off. That is what keeps the chunk out of the first-paint bundle without
 * losing the closing animation — gating the render on `isOpen` alone would rip
 * the dialog out of the tree the moment it starts fading out.
 */
export const useLazyOverlay = (): {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  shouldRender: boolean;
} => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const setOpen = useCallback((open: boolean) => {
    if (open) {
      setShouldRender(true);
    }
    setIsOpen(open);
  }, []);

  return { isOpen, setIsOpen: setOpen, shouldRender };
};
