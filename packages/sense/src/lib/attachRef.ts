import type * as React from 'react';

/**
 * Forwards `node` to a caller's ref and returns the matching release, so a
 * component can merge its own callback ref with the one it was given.
 */
function attachRef<T>(
  ref: React.Ref<T> | undefined,
  node: T | null,
): () => void {
  if (typeof ref === 'function') {
    const cleanup = ref(node);
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      } else {
        ref(null);
      }
    };
  }
  if (ref) {
    ref.current = node;
    return () => {
      ref.current = null;
    };
  }
  return () => {};
}

export { attachRef };
