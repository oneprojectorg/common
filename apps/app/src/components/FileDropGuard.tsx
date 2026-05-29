'use client';

import { useEffect } from 'react';

// Browsers navigate to (open) a file when it's dropped anywhere outside a valid
// drop target — drop an image onto the page and the raw image replaces the app.
// This window-level guard prevents that default for file drags everywhere,
// while leaving real drop targets (ResourceDropZone, the Add Resource form,
// post attachments, the rich-text editor) working: it only preventDefault()s,
// never stopPropagation()s, and runs in the bubble phase so those handlers fire
// first. Scoped to file drags so it doesn't interfere with text/link dragging.
export const FileDropGuard = () => {
  useEffect(() => {
    const isFileDrag = (event: DragEvent): boolean =>
      event.dataTransfer
        ? Array.from(event.dataTransfer.types).includes('Files')
        : false;
    const preventFileDrag = (event: DragEvent) => {
      if (isFileDrag(event)) {
        event.preventDefault();
      }
    };
    window.addEventListener('dragover', preventFileDrag);
    window.addEventListener('drop', preventFileDrag);
    return () => {
      window.removeEventListener('dragover', preventFileDrag);
      window.removeEventListener('drop', preventFileDrag);
    };
  }, []);

  return null;
};
