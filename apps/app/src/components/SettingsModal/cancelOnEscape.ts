import type { KeyboardEvent } from 'react';

// the Dialog owns Escape; stop it here so Escape cancels the inline step instead of closing the modal
export const cancelOnEscape =
  (onCancel: () => void) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };
