'use client';

import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useState } from 'react';

export interface UseRichTextEditorFloatingToolbarProps {
  editor: Editor | null;
  enabled?: boolean;
}

export function useRichTextEditorFloatingToolbar({
  editor,
  enabled = true,
}: UseRichTextEditorFloatingToolbarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Handle text selection for floating toolbar
  const handleSelectionChange = useCallback(() => {
    if (!editor || !enabled) return;

    const { state } = editor;
    const { selection } = state;
    const { from, to } = selection;

    // Show floating toolbar only if there's a text selection
    if (from === to) {
      setIsVisible(false);
      return;
    }

    // Get the DOM selection to calculate position
    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) {
      setIsVisible(false);
      return;
    }

    const range = domSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      setIsVisible(false);
      return;
    }

    // Position the floating toolbar above the selection
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;

    setPosition({
      top: rect.top + scrollTop - 50, // Position above selection
      left: rect.left + scrollLeft + rect.width / 2 - 200, // Center horizontally (wider toolbar)
    });

    setIsVisible(true);
  }, [editor, enabled]);

  // Set up selection listener for floating toolbar
  useEffect(() => {
    if (!editor || !enabled) return;

    const handleSelectionUpdate = () => {
      // Use setTimeout to ensure the DOM selection is updated
      setTimeout(handleSelectionChange, 0);
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    editor.on('transaction', handleSelectionUpdate);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('transaction', handleSelectionUpdate);
    };
  }, [editor, handleSelectionChange, enabled]);

  // Hide floating toolbar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isVisible) {
        const target = event.target as HTMLElement;
        if (
          !target.closest('[data-floating-toolbar]') &&
          !target.closest('.ProseMirror')
        ) {
          setIsVisible(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible]);

  return {
    isVisible,
    position,
    handleSelectionChange,
  };
}