'use client';

import type { Editor } from '@tiptap/react';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ActiveEditorContextValue {
  /** The TipTap editor instance that currently has focus, or null. */
  activeEditor: Editor | null;
  /**
   * Register a TipTap editor so its focus/blur events are tracked.
   * Call this once when the editor is ready (e.g. via `onEditorReady`).
   * Returns a cleanup function that unregisters the editor.
   */
  registerEditor: (editor: Editor) => () => void;
}

const ActiveEditorCtx = createContext<ActiveEditorContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Tracks which TipTap editor currently has focus across multiple
 * `CollaborativeTextField` instances.
 *
 * Wrap any area that contains multiple editors and a shared toolbar with
 * this provider, then read `activeEditor` via {@link useActiveEditor}.
 *
 * Focus/blur race condition: when clicking from editor A to editor B,
 * `blur` fires before `focus`. A naïve implementation would flash
 * `activeEditor` to `null` between transitions. We avoid this by
 * deferring the blur-to-null via `requestAnimationFrame` and cancelling
 * the deferred clear when a focus fires first.
 */
export function ActiveEditorProvider({ children }: { children: ReactNode }) {
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);

  // Ref to the pending rAF id so we can cancel blur→null when a focus
  // fires immediately after (editor-to-editor tabbing).
  const pendingBlurRef = useRef<number | null>(null);

  const registerEditor = useCallback((editor: Editor) => {
    const handleFocus = () => {
      // Cancel any pending blur→null from a previous editor
      if (pendingBlurRef.current !== null) {
        cancelAnimationFrame(pendingBlurRef.current);
        pendingBlurRef.current = null;
      }
      setActiveEditor(editor);
    };

    const handleBlur = () => {
      // Defer setting null so that if another editor immediately focuses,
      // we skip the null flash entirely.
      pendingBlurRef.current = requestAnimationFrame(() => {
        pendingBlurRef.current = null;
        setActiveEditor((current) => (current === editor ? null : current));
      });
    };

    editor.on('focus', handleFocus);
    editor.on('blur', handleBlur);

    return () => {
      editor.off('focus', handleFocus);
      editor.off('blur', handleBlur);

      // If this editor was active, clear it
      setActiveEditor((current) => (current === editor ? null : current));

      // Cancel any pending rAF from this editor
      if (pendingBlurRef.current !== null) {
        cancelAnimationFrame(pendingBlurRef.current);
        pendingBlurRef.current = null;
      }
    };
  }, []);

  return (
    <ActiveEditorCtx.Provider value={{ activeEditor, registerEditor }}>
      {children}
    </ActiveEditorCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the currently-focused editor, or null if no editor has focus.
 * Must be called within an {@link ActiveEditorProvider}.
 */
export function useActiveEditor(): Editor | null {
  const ctx = useContext(ActiveEditorCtx);
  if (!ctx) {
    throw new Error(
      'useActiveEditor must be used within an <ActiveEditorProvider>',
    );
  }
  return ctx.activeEditor;
}

/**
 * Returns the `registerEditor` function from the nearest
 * {@link ActiveEditorProvider}. Returns `null` if no provider is present,
 * allowing `CollaborativeTextField` to work without the provider (e.g. in
 * preview mode or standalone usage).
 */
export function useRegisterEditor(): ((editor: Editor) => () => void) | null {
  const ctx = useContext(ActiveEditorCtx);
  return ctx?.registerEditor ?? null;
}
