import * as React from 'react';

type TextareaRef = React.ComponentProps<'textarea'>['ref'];

/**
 * Sizes a textarea to its content where `field-sizing: content` is unsupported
 * (Firefox). Elsewhere it only passes the ref through. Attach the returned ref.
 */
function useFieldSizingFallback(
  ref: TextareaRef,
  value: React.ComponentProps<'textarea'>['value'],
): React.RefCallback<HTMLTextAreaElement> {
  const fieldRef = React.useRef<HTMLTextAreaElement | null>(null);

  const mergedRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      fieldRef.current = node;
      const release = attach(ref, node);
      return () => {
        fieldRef.current = null;
        release();
      };
    },
    [ref],
  );

  React.useLayoutEffect(() => {
    if (!supportsFieldSizing()) {
      fitToContent(fieldRef.current);
    }
  }, [value]);

  React.useEffect(() => {
    const field = fieldRef.current;
    if (!field || supportsFieldSizing()) {
      return;
    }
    const refit = () => fitToContent(field);
    // `input` covers an uncontrolled field; the observer covers a width change.
    field.addEventListener('input', refit);
    const observer = new ResizeObserver(refit);
    observer.observe(field);
    return () => {
      field.removeEventListener('input', refit);
      observer.disconnect();
    };
  }, []);

  return mergedRef;
}

function attach(ref: TextareaRef, node: HTMLTextAreaElement | null) {
  if (typeof ref === 'function') {
    const cleanup = ref(node);
    return typeof cleanup === 'function' ? cleanup : () => ref(null);
  }
  if (ref) {
    ref.current = node;
    return () => {
      ref.current = null;
    };
  }
  return () => {};
}

function fitToContent(field: HTMLTextAreaElement | null) {
  if (!field) {
    return;
  }
  field.style.height = 'auto';
  // Border-box: `scrollHeight` leaves out the borders.
  field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
}

let fieldSizingSupport: boolean | undefined;

function supportsFieldSizing() {
  fieldSizingSupport ??= CSS.supports('field-sizing', 'content');
  return fieldSizingSupport;
}

export { useFieldSizingFallback };
