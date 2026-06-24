import type { ComponentType } from 'react';

export interface SlashCommandItem {
  title: string;
  description: string;
  searchTerms: string[];
  icon: ComponentType<{ className?: string }>;
  command: ({ editor, range }: { editor: any; range: any }) => void;
}

/**
 * The state the React menu (`SlashCommandMenu`) renders from. The `@tiptap/
 * suggestion` plugin (see `SlashCommands`) writes to it via the controller; the
 * menu subscribes. The menu renders in the React tree (NOT a detached
 * `createRoot`), so it gets app providers, i18n, and design tokens.
 *
 * This bridge lives in the editor layer (not the decisions domain) so the
 * generic menu component and the domain extension both depend inward on it,
 * rather than the menu reaching across into `decisions/`.
 */
export interface SlashMenuSnapshot {
  open: boolean;
  items: SlashCommandItem[];
  command: ((item: SlashCommandItem) => void) | null;
  clientRect: (() => DOMRect | null) | null;
}

export interface SlashMenuController {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => SlashMenuSnapshot;
  update: (partial: Partial<SlashMenuSnapshot>) => void;
  /** The open menu registers its key handler; the suggestion delegates to it. */
  setKeyHandler: (handler: ((event: KeyboardEvent) => boolean) | null) => void;
  handleKeyDown: (event: KeyboardEvent) => boolean;
}

export const EMPTY_SNAPSHOT: SlashMenuSnapshot = {
  open: false,
  items: [],
  command: null,
  clientRect: null,
};

export function createSlashMenuController(): SlashMenuController {
  let snapshot = EMPTY_SNAPSHOT;
  const listeners = new Set<() => void>();
  let keyHandler: ((event: KeyboardEvent) => boolean) | null = null;

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    update: (partial) => {
      snapshot = { ...snapshot, ...partial };
      listeners.forEach((listener) => listener());
    },
    setKeyHandler: (handler) => {
      keyHandler = handler;
    },
    handleKeyDown: (event) => keyHandler?.(event) ?? false,
  };
}

/**
 * Read the per-editor slash controller off editor storage. Returns undefined
 * when the editor doesn't have the SlashCommands extension — `SlashCommandMenu`
 * uses that to no-op.
 */
export function getSlashMenuController(
  editor: { storage?: Record<string, any> } | null | undefined,
): SlashMenuController | undefined {
  return editor?.storage?.['slash-commands']?.controller as
    | SlashMenuController
    | undefined;
}
